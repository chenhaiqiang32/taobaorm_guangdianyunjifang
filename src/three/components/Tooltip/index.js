import { createCSS2DObject } from "../../../lib/CSSObject";

export class Tooltip {
  constructor() {
    this.element = null;
    this.css2dObject = null;
    this.isVisible = false;
    this.createTooltip();
  }

  createTooltip() {
    // 创建提示框容器
    const tooltipContainer = document.createElement("div");
    tooltipContainer.className = "building-tooltip-container";
    tooltipContainer.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.2s ease;
      transform: translate(-50%, -100%);
      margin-top: -8px;
    `;

    // 创建提示内容
    const tooltipContent = document.createElement("div");
    tooltipContent.innerHTML = "双击进入室内，单击拉近视角";
    tooltipContainer.appendChild(tooltipContent);

    // 创建箭头
    const arrow = document.createElement("div");
    arrow.style.cssText = `
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid rgba(0, 0, 0, 0.8);
    `;
    tooltipContainer.appendChild(arrow);

    this.element = tooltipContainer;
    this.css2dObject = createCSS2DObject(tooltipContainer);
    this.css2dObject.visible = false;
  }

  show(position) {
    if (!this.isVisible) {
      this.css2dObject.position.copy(position);
      this.css2dObject.visible = true;
      this.element.style.opacity = "1";
      this.isVisible = true;
    }
  }

  hide() {
    if (this.isVisible) {
      this.element.style.opacity = "0";
      setTimeout(() => {
        this.css2dObject.visible = false;
        this.isVisible = false;
      }, 200);
    }
  }

  updatePosition(position) {
    if (this.isVisible) {
      this.css2dObject.position.copy(position);
    }
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.css2dObject = null;
  }
}
