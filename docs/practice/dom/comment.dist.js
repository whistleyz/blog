(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
    ? define(factory)
    : ((global = typeof globalThis !== 'undefined' ? globalThis : global || self),
      (global.commentapi = factory()));
})(this, function () {
  'use strict';

  /**
   * @file: description
   * @author: yongzhen
   * @Date: 2021-01-08 14:34:43
   * @LastEditors: yongzhen
   * @LastEditTime: 2021-01-08 14:35:12
   */
  const dom = {
    getDelegateNodeContainsTarget(selector, target, root) {
      let delegateNode = target;
      while (delegateNode) {
        if (delegateNode.matches(selector)) {
          return delegateNode;
        }
        if (root === delegateNode) {
          return null;
        }
        delegateNode = delegateNode.parentNode;
      }
      return null;
    },
    template(node, template) {
      node.innerHTML = template;
    }
  };

  /**
   * @file: description
   * @author: yongzhen
   * @Date: 2021-01-08 14:34:11
   * @LastEditors: yongzhen
   * @LastEditTime: 2021-01-10 15:10:14
   */

  const UN_BUBBLES_EVENTS = ['focus', 'blur'];

  class BaseViewController {
    constructor(options) {
      this.options = options;
      this.el = options.el;

      this._events = [];
    }

    // 事件委托
    delegateEvent(selector, action, cb) {
      const handler = event => {
        const delegateNode = dom.getDelegateNodeContainsTarget(selector, event.target, this.el);
        if (delegateNode) {
          event.delegateNode = delegateNode;
          cb(event);
        }
      };
      const removeEvent = () => {
        this.el.removeEventListener(action, handler);
        this._events = this._events.filter(item => item !== removeEvent);
      };

      const useCapture = UN_BUBBLES_EVENTS.includes(action);

      this.el.addEventListener(action, handler, useCapture);
      this._events.push(removeEvent);

      return removeEvent;
    }

    distroyEvents() {
      this._events.forEach(removeEvent => removeEvent());
    }
  }

  /**
   * @file: description
   * @author: yongzhen
   * @Date: 2021-01-08 14:37:30
   * @LastEditors: yongzhen
   * @LastEditTime: 2021-01-08 14:39:05
   */

  class ListViewController extends BaseViewController {
    constructor(options) {
      super(options);

      this.viewState = {
        loading: false,
        dataSource: []
      };

      this.init();
    }

    init() {
      this.loadCommentList();
    }

    loadCommentList() {
      this.viewState.loading = true;
      this.render();

      setTimeout(() => {
        this.viewState.loading = false;
        this.render();
      }, 1500);
    }

    render() {
      if (this.viewState.loading) {
        dom.template(
          this.el,
          `
        <div class="d-flex align-items-center">
          <strong>Loading...</strong>
          <div class="spinner-border spinner-border-sm ms-auto" role="status" aria-hidden="true"></div>
        </div>
        `
        );
      } else {
        dom.template(
          this.el,
          `
        <ul class="list-group list-group-flush">
          <li class="list-group-item">Cras justo odio</li>
          <li class="list-group-item">Dapibus ac facilisis in</li>
          <li class="list-group-item">Morbi leo risus</li>
          <li class="list-group-item">Porta ac consectetur ac</li>
          <li class="list-group-item">Vestibulum at eros</li>
        </ul>
        `
        );
      }
    }
  }

  /**
   * @file: description
   * @author: yongzhen
   * @Date: 2021-01-08 14:38:22
   * @LastEditors: yongzhen
   * @LastEditTime: 2021-01-13 18:26:57
   */

  /**
   * type validator = {
   *   required: true
   * } | (fieldValue) => boolean
   * type validatorMap = {
   *   fieldName: validator[]
   * }
   */
  const validatorMap = {
    nickname: [{ required: true, message: '请输入昵称' }],
    user_email: [
      { required: true, message: '请输入电子邮箱' },
      {
        validator: function (value) {
          return /\S+@\S+\.\S+/.test(value);
        },
        message: '输入的电子邮箱格式不正确'
      }
    ],
    comment: [
      { maxLen: 20, message: '您输入的文字太多' },
      { minLen: 10, message: '您输入的文字太少' }
    ]
  };

  class FormViewControler extends BaseViewController {
    constructor(options) {
      super(options);

      this.init();
    }

    init() {
      this.render();

      this.formEl = this.el.querySelector('#comment-form');
      this.formHelper = new FormHelper({
        el: this.formEl,
        validatorMap: validatorMap
      });

      this.formHelper.bindSubmitCallback(this.onSubmit.bind(this));
    }

    onSubmit(event, fieldValueMap) {
      alert(JSON.stringify(fieldValueMap));
    }

    render() {
      dom.template(
        this.el,
        `
      <form id="comment-form">
        <div class="form-group">
          <label for="nickname">nickname</label>
          <input type="text" class="form-control" name="nickname">
          <div class="invalid-feedback">
            Please provide a valid city.
          </div>
          <div class="valid-feedback">
            Looks good!
          </div>
        </div>
        <div class="form-group">
          <label for="user_email">Email</label>
          <input type="email" class="form-control" name="user_email">
          <small class="form-text text-muted">We'll never share your email with anyone else.</small>
        </div>
        <div class="form-group">
          <label for="comment">Content</label>
          <textarea class="form-control" name="comment" rows="3"></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Submit</button>
      </form>
      `
      );
    }
  }

  class FormHelper extends BaseViewController {
    constructor(options) {
      super(options);

      this.init();
    }

    init() {
      this.delegateEvent('.form-control', 'blur', this._handleFormControlBlur.bind(this));
    }

    bindSubmitCallback(callback) {
      this.delegateEvent('button[type="submit"]', 'click', event => {
        event.preventDefault();

        const { errors, fieldValueMap } = this.validateForm();

        if (errors.length === 0) {
          callback(event, fieldValueMap);
        }
      });
    }

    _handleFormControlBlur(e) {
      const fieldName = e.target.name;
      const fieldVal = e.target.value;

      this.validateField(fieldName, fieldVal);
    }

    validateForm() {
      const controlEls = this.el.querySelectorAll('.form-control');
      const allFieldErrors = [];
      const fieldValueMap = {};

      controlEls.forEach(controlEl => {
        const fieldName = controlEl.name;
        const fieldVal = controlEl.value;

        const errors = this.validateField(fieldName, fieldVal);
        if (errors.length) {
          allFieldErrors.push({
            field: fieldName,
            errors
          });
        }

        fieldValueMap[fieldName] = fieldVal;
      });

      return {
        errors: allFieldErrors,
        fieldValueMap: fieldValueMap
      };
    }

    setFieldControlInValid(fieldName, errors) {
      const fieldControlEl = this.el.querySelector(`.form-control[name="${fieldName}"]`);
      const parentNode = fieldControlEl.parentNode;
      const invalidEls = parentNode.querySelectorAll('.invalid-feedback');
      const fragement = document.createDocumentFragment();

      fieldControlEl.classList.remove('is-valid');
      fieldControlEl.classList.add('is-invalid');

      invalidEls.forEach(invalidEl => {
        parentNode.removeChild(invalidEl);
      });

      errors.forEach(errorMessage => {
        const invalidEl = document.createElement('div');
        invalidEl.textContent = errorMessage;
        invalidEl.classList.add('invalid-feedback');

        fragement.appendChild(invalidEl);
      });

      parentNode.appendChild(fragement);
    }

    setFieldControlValid(fieldName) {
      const fieldControlEl = this.el.querySelector(`.form-control[name="${fieldName}"]`);
      fieldControlEl.classList.remove('is-invalid');
      fieldControlEl.classList.add('is-valid');
    }

    validateField(fieldName, fieldVal) {
      const validators = this.options.validatorMap[fieldName];

      if (!validators) {
        return [];
      }

      const errors = this.validate(fieldVal, validators);

      if (errors.length) {
        this.setFieldControlInValid(fieldName, errors);
      } else {
        this.setFieldControlValid(fieldName);
      }

      return errors;
    }

    validate(fieldVal, validators) {
      const errors = [];
      validators.forEach(validator => {
        const validatorObj = {
          fieldVal,
          validator: null, // internal validator key or custom validator function
          errorMessgae: '',
          options: null
        };

        for (let key in validator) {
          if (key === 'message') {
            validatorObj.errorMessgae = validator[key];
            continue;
          }
          if (key === 'validator') {
            // custom validator
            validatorObj.validator = validator[key];
            continue;
          }

          const internalValidator = FormHelper.internalValidatorMap[key];

          if (internalValidator) {
            validatorObj.validator = internalValidator;
            validatorObj.options = validator[key];
          } else {
            throw new Error('unknown options: ' + key);
          }
        }

        // invoke validator
        const isValid = validatorObj.validator(validatorObj.fieldVal, validatorObj.options);
        if (!isValid) {
          errors.push(validatorObj.errorMessgae);
        }
      });
      return errors;
    }

    validateInternal(fieldVal, validatorMap) {
      let isValid = true;
      Object.keys(validatorMap).forEach(key => {
        const internalValidator = FormHelper.internalValidatorMap[key];

        if (internalValidator) {
          isValid = internalValidator(fieldVal, validatorMap[key]);
        }
      });
      return isValid;
    }

    static internalValidatorMap = {
      required(value, required) {
        if (required) {
          return value !== 0 && Boolean(value);
        }
        return true;
      },
      maxLen(value, len) {
        if (typeof value === 'string' && value.length > len) {
          return false;
        }
        return true;
      },
      minLen(value, len) {
        if (typeof value === 'string' && value.length < len) {
          return false;
        }
        return true;
      }
    };
  }

  /**
   * @file: description
   * @author: yongzhen
   * @Date: 2021-01-08 14:36:40
   * @LastEditors: yongzhen
   * @LastEditTime: 2021-01-08 20:08:04
   */

  class CommentViewController extends BaseViewController {
    constructor(options) {
      super(options);

      this.viewState = {
        tabs: [
          {
            key: 'comment-list',
            defaultActive: true,
            title: '评论列表'
          },
          {
            key: 'comment-form',
            defaultActive: false,
            title: '发布评论'
          }
        ]
      };

      this.init();
    }

    init() {
      this.mount();

      this.tabNavEl = this.el.querySelector('#comment-tab-nav');
      this.tabNavContentEl = this.el.querySelector('#comment-tab-content');
      this.listEl = this.tabNavContentEl.querySelector('[data-key="comment-list"]');
      this.formEl = this.tabNavContentEl.querySelector('[data-key="comment-form"]');

      this.listViewController = new ListViewController({ el: this.listEl });
      this.formViewController = new FormViewControler({ el: this.formEl });

      this.delegateEvent('.nav-link', 'click', this._handleTabNavLinkClick.bind(this));
    }

    _handleTabNavLinkClick(e) {
      const selectedKey = e.delegateNode.dataset.key;
      this.selectNavItem(selectedKey);
    }

    selectNavItem(selectedKey) {
      const tabItems = Array.from(this.tabNavEl.querySelectorAll('.nav-link'));
      const tabContentItems = Array.from(this.tabNavContentEl.querySelectorAll('.tab-pane'));

      tabItems.forEach(tabItem => {
        if (tabItem.dataset.key === selectedKey) {
          tabItem.classList.add('active');
        } else {
          tabItem.classList.remove('active');
        }
      });

      tabContentItems.forEach(tabContentItem => {
        if (tabContentItem.dataset.key === selectedKey) {
          tabContentItem.classList.add('active');
          tabContentItem.classList.add('show');
        } else {
          tabContentItem.classList.remove('active');
          tabContentItem.classList.remove('show');
        }
      });
    }

    mount() {
      dom.template(
        this.el,
        `
      <div class="comment-container">
        <ul class="nav nav-tabs" id="comment-tab-nav">
          ${this.viewState.tabs
            .map(tabItem => {
              const activeClassName = tabItem.defaultActive ? 'active' : '';
              return `
                <li class="nav-item">
                  <a
                    class="nav-link ${activeClassName}"
                    data-key="${tabItem.key}"
                  >
                    ${tabItem.title}
                  </a>
                </li>
              `;
            })
            .join('')}
        </ul>

        <div class="tab-content" id="comment-tab-content">
          <div class="tab-pane fade show active" data-key="comment-list"></div>
          <div class="tab-pane fade" data-key="comment-form">profile</div>
        </div>
      </div>
    `
      );
    }

    distory() {
      this.distroyEvents.forEach(remove => remove());
    }
  }

  /**
   * @file: description
   * @author: yongzhen
   * @Date: 2021-01-08 14:39:13
   * @LastEditors: yongzhen
   * @LastEditTime: 2021-01-13 19:00:00
   */
  const COMMENT_STYLE = `
.comment-container {
  backgroud-color: #fff;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
  z-index: 100000;
}
.comment-container .tab-content {
  padding-top: 8px
}
`;

  /**
   * @file: description
   * @author: yongzhen
   * @Date: 2021-01-07 09:40:08
   * @LastEditors: yongzhen
   * @LastEditTime: 2021-01-13 16:28:39
   */

  class CommentApi {
    static init(root, options) {
      CommentApi.DEBUG_loadBootstrapStyle();
      CommentApi.loadStyle(root);

      const container = document.createElement('div');
      root.appendChild(container);

      return new CommentViewController({
        el: container,
        ...options
      });
    }

    static loadStyle(root) {
      const style = document.createElement('style');
      style.innerHTML = COMMENT_STYLE;
      root.appendChild(style);
    }

    static DEBUG_loadBootstrapStyle() {
      const link = document.createElement('link');
      link.setAttribute(
        'href',
        'https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css'
      );
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('crossorigin', 'anonymous');
      document.head.appendChild(link);
    }
  }

  return CommentApi;
});