# Vue computed 与记忆函数

## 1 背景

假设有以下一段代码，render 方法的参数 c 是经常变化的，而 a、b 则变化不频繁。分析这段代码可以得出一个结论：每次 render 函数被调用都会触发 calc 函数的调用，如果 a、b 参数没有发生改变，那么就会增加没有必要的计算。

```js
function calc (a, b) {
  console.log('calc', a, b)
  // 复杂的计算
  return a ** b
}

function render (a, b, c) {
  console.log('render', a, b, c)
  return {
    status: c % 10,
    result: calc(a, b)
  }
}
```

解决这种问题的方法有很多，相信聪明的你已经想出来用缓存的方法可以解决这样的问题；这里介绍给大家 Memoize Function 一种解决问题的思路。

## 2 记忆函数

其原理是通过对函数参数、计算结果进行缓存，再次调用进行比较：如果参数发生了变化，那么需要进行重新计算；如果参数没有发生变化，则返回上一次的计算结果：

```js
function createMemo (targetFunc) {
  let lastArgs = null
  let lastResult = null
  // 通过一个闭包函数缓存参数和运算结果
  return function (...args) {
    if (!argumentsShallowlyEqual(lastArgs, args)) {
			lastResult = targetFunc(...args)
    }
    lastArgs = args
    return lastResult
  }
}
// 判断引用相等即可
function argumentsShallowlyEqual (prev, next) {
  if (prev === null || next === null || prev.length !== next.length) {
    return false
  }
  const length = prev.length
  for (let i=0; i<length; i++) {
    if (prev[i] !== next[i]) {
      return false
    }
  }
  return true
}
```

现在将 calc 方法封装一下再进行测试，结果是符合预期的：

```js
calc = createMemo(calc)
render(1,2,3)
// render 1 2 3
// calc 1 2
render(1,2,3)
// render 1 2 3
render(2,2,3)
// render 2 2 3
// calc 2 2
render(2,2,3)
// render 2 2 3
```

不过简单的缓存并不能 cover 住复杂的 Redux 应用程序，还需要对 createMemo 方法进行进一步拓展。比如我们有以下 redux 相关代码片段，我们希望在原有逻辑改动不大的情况下，引入记忆函数来优化性能：

```js
const state = {
  filter: 'done',
  todos: [{
    status: 'done'
  }, {
    status: 'doing'
  }]
}
const getTodos = state => state.todos
const getFilter = state => state.filter
const getDoingTodos = (filter, todos) => todos.filter(item => item.status === filter)
```

记忆函数应该支持组合的，这样在 redux 应用中，不修改代码基本就可以完成优化：

```js
const getDoingTodos = createMemo(
  state => getFilter(state),
  state => getTodos(state),
  (filter, todos) => todos.filter(item => item.status === filter)
)
```

所以还需要再来修改一下 createMemo 方法以支持组合的情况：


```js
function createMemo (...funcs) {
  const targetFunc = funcs.pop()
  const dependencies = [...funcs]
  
	const memoizedTargetFunc = defaultMemoize(targetFunc)
  const selector = defaultMemoize(function (...args) {
    const params = []
    const length = dependencies.length
    
    for (let i=0; i<length; i++) {
      params.push(dependencies[i](...args))
    }
    return memoizedTargetFunc(...params)
  })
  return selector
}

function defaultMemoize (func) {
  let lastArgs = null
  let lastResult = null
  
  return function (...args) {
    if (!argumentsShallowlyEqual(lastArgs, args)) {
      lastResult = func(...args)
    }
    lastArgs = args
    return lastResult
  }
}
// 判断引用相等即可
function argumentsShallowlyEqual (prev, next) {
  if (prev === null || next === null || prev.length !== next.length) {
    return false
  }
  const length = prev.length
  for (let i=0; i<length; i++) {
    if (prev[i] !== next[i]) {
      return false
    }
  }
  return true
}
```

这里要注意的是，createMemo 我们创建了两个 'memoize' 的函数，selector 缓存的参数是 `status` ，memoizedTargetFunc 缓存的参数是 `filter` 、`todos` 。由于记忆函数在 argumentsShallowlyEqual 函数中判断参数是否发生改变，仅仅是进行 `ShallowlyEqual` 。所以，想要进一步判断相等，可能还需要引入不可变数据 (immutable.js) 、重置 argumentsShallowlyEqual 等。

> 参考
>
> Redux 计算衍生数据：https://www.redux.org.cn/docs/recipes/ComputingDerivedData.html
>
> Reselect https://github.com/reduxjs/reselect

在 Vue 中也有计算属性能达到类似效果，他们在实现上和用法都有一些不同。在 Redux 中，需要缓存的函数可能都需要用 createMemo 方法封装一下，例如示例中，如果 getTodos 方法也需要进行大量计算，那么还需要对 getTodos 方法套个记忆函数的壳，而 Vue 自带计算属性，一个 computed 就可以实现类似的能力。

## 3 Vue computed

### 3.1 基本用法

```js
const Demo1 = new Vue({
  template: '<div>{{b}}</div>',
  data () {
    return {
      a: 1
    }
  },
  computed: {
    b () {
      return a + 1
    }
  }
})
```

相信你对上面的代码再熟悉不过了，现在进行简单修改，如果计算属性依赖的路径过多，那么你知道它在 Vue 中如何被更新的吗？

```js
const Demo2 = new Vue({
  template: '<div>{{b}}{{c}}</div>',
  data () {
    return {
      a: 1
    }
  },
  computed: {
    b () {
      console.log('b')
      return a + 1
    },
    c () {
      console.log('c')
      return b + a
    }
  }
})
```

如果这时候改变 a ，那么 c 、b 计算属性中各打印几次 ？

### 3.2 原理

实例化一个 Vue 组件大致经历以下过程，从下面的简化代码可以看出，计算属性 computed 主要在 initComputed 方法中初始化。

```js
// https://github.com/vuejs/vue/blob/dev/src/core/instance/index.js#L8
function Vue (options) {
  this._init(options)
}

Vue.prototype._init = function (options) {
  // ...
  // https://github.com/vuejs/vue/blob/dev/src/core/instance/init.js#L52
  initLifecycle(vm)
  initEvents(vm)
  initRender(vm)
  callHook(vm, 'beforeCreate')
  initInjections(vm) // resolve injections before data/props
  initState(vm)
}

// https://github.com/vuejs/vue/blob/dev/src/core/instance/state.js#L48
function initState (vm) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}
```

那么 initComputed 方法做了哪些事情呢 ？

```js
const computedWatcherOptions = { lazy: true }
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}
```

阅读上面的代码之后可以发现，在 computed 初始化阶段主要做了两件事情：

1. 遍历每个属性，为每个属性实例化一个 `lazy` Watcher
2. 为每个属性 defineComputed

Watcher 的实例化稍微有点复杂，待会再说，先往下走，看看 defineComputed 做了什么事情。

#### 3.2.1 defineComputed

这个过程很简单，类似于将一个对象 defineReactive 。

```js
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}
```

这里主要关注 computedGetter 方法，在这之前，先来了解一下 watcher 的几个属性方法，后面会详细去说：

- watcher.dirty 是标记 watcher 是否需要重新求值，当计算属性的依赖发生变化时 dirty 会被赋值为 true ，因为需要重新进行 watcher.evaluate
- watcher.evaluate 所做的事情就是求值，即运行 userDef 函数，求值完成后将 dirty 赋值为 false
- watcher.depend 依赖当前的 Dep.target，比如当前正在处于渲染过程中，Darget.target 为渲染 watcher ，那么当前计算属性的 watcher 会被渲染 watcher 收集，这样计算属性作为渲染 watcher 的一个依赖，所以计算属性改变会触发渲染 watcher 更新

获取计算属性的值时，会触发 computedGetter 方法，首次调用会触发 watcher.evalute 计算，这中间会有依赖收集的过程；计算完成后，会进行值的缓存，那么计算属性再次被调用就不会触发求值。

到这里你可能有点懵懂，实际上 Watcher 是计算属性实现的关键，像要了解计算属性，必须要深入 Watcher 的实现。

#### 3.2.2 lazy Watcher

经简化后， Watcher 与计算属性相关的部分源代码如下：

```js
// https://github.com/vuejs/vue/blob/dev/src/core/observer/watcher.js#L26
class Watcher {
  constructor(
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
		this.vm = vm
    this.lazy = !!options.lazy
		this.dirty = this.lazy
    this.getter = expOrFn
    // lazy watcher 不立即求值
    this.value = this.lazy ? undefined : this.get()
  }
  
  get () {
    pushTarget(this)
    let value
    value = this.getter.call(vm, vm)
    if (this.deep) {
      traverse(value)
    }
    popTarget()
    this.cleanupDeps()
    return value
  }
  
  update () {
    /* istanbul ignore else */
    // 计算属性的依赖发生更新时
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }
  
  // 计算属性取值时触发
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }
}
```

可以分三个过程来解释这部分代码：Watcher 实例化过程、计算属性取值过程、依赖更新过程

1. 计算属性初始化 即 Watcher 实例化过程

initComputed 在遍历计算属性的过程中，实例化 watcher 时， lazy 会被赋值为 true ，即实例化了一个 `lazy` Watcher
如果当前是一个 `lazy` Watcher 的话，那么不会立即去求值。

2. 计算属性取值过程

当触发计算属性的 computedGetter 取值函数时，会调用 watcher.evaluate 方法，这个方法才真正的调用 getter 函数（也就是开发者定义的 computed 的函数）来计算结果，并将结果缓存到 watcher.value 中

当 watcher.get 被调用时，Dep.target 会变为当前这个计算属性的 watcher ，所以 this.getter 调用的时候，函数内部的所有依赖会被当前 watcher 收集。

> 这里依赖收集的过程如果你不是很了解的话，推荐你看一下 Vue 源码中 observer 的过程，或者看一下我的另一篇相关的文章 [深入了解 vue 响应式原理](https://blog.easydog.club/principle/reactive_vue#vue-原理)

当 watcher.evaluate 调用完成后，dirty 会被立即设置为 false ，所以后续再触发计算属性的取值函数，则不会重新计算，这样就达到了缓存的效果。

3. 依赖更新的过程

当计算属性的依赖更新时，会触发计算属性 watcher.update 方法，这里并不进行求值，仅仅是将当前的 dirty 赋值为 false ， 表明当前的 watcher 的依赖已经发生变化，那么下一次计算属性被调用时，就会触发重新求值。这里就解释了，当计算属性的依赖更新时，计算属性并不会立即重新计算，而是当调用的时候才会重新求值。

## 4 总结

先回答一下 3.1 节中提出的问题，当 a 改变了，c、b 各打印一次，而且 c、b 的求值时惰性的，如果模版里面没有依赖 b、c，他们是不会打印的。

以上，本文详细分析了记忆函数与 Vue 的计算属性，Vue 的计算属性很巧妙的结合 Vue 自身响应式特性实现，Redux 也是通过简单的记忆函数就能实现性能优化。



