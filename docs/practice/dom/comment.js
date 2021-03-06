/**
 * @file: description
 * @author: yongzhen
 * @Date: 2021-01-07 09:40:08
 * @LastEditors: yongzhen
 * @LastEditTime: 2021-01-20 16:49:31
 */
import CommentViewController from './CommentViewController';
import { COMMENT_STYLE } from './style';

export default class CommentApi {
  static instance = null;

  static create(root, options) {
    if (!root) {
      throw new TypeError('root should be an HTMLElement');
    }

    // CommentApi.DEBUG_loadBootstrapStyle();
    CommentApi.loadStyle(root);
    const commentEl = document.createElement('div');
    root.appendChild(commentEl);

    return new CommentViewController({
      el: commentEl,
      ...options
    });
  }

  static init(root, options) {
    if (!root) {
      root = document.createElement('div');
    }
    if (!this.instance) {
      this.instance = CommentApi.create(root, options);
    }

    return this.instance;
  }

  static loadStyle(root) {
    const style = document.createElement('style');
    style.innerHTML = COMMENT_STYLE;
    root.appendChild(style);
  }

  static async DEBUG_loadBootstrapStyle() {
    const link = document.createElement('link');
    link.setAttribute(
      'href',
      'https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css'
    );
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('crossorigin', 'anonymous');
    document.head.appendChild(link);

    link.addEventListener('load', () => {
      console.log(123);
    });
  }
}
