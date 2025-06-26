export class SceneHint {
  constructor() {
    this.element = null;
    this.isVisible = false;
    this.createHint();
  }

  createHint() {
    // 创建提示框容器
    const hintContainer = document.createElement("div");
    hintContainer.className = "scene-hint-container";
    hintContainer.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      background: rgba(0, 0, 0, 0.8) !important;
      color: white !important;
      padding: 12px 16px !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      white-space: nowrap !important;
      pointer-events: none !important;
      z-index: 9999 !important;
      opacity: 0 !important;
      transition: opacity 0.3s ease !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      backdrop-filter: blur(4px) !important;
      font-family: Arial, sans-serif !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
      display: block !important;
      visibility: visible !important;
      height: auto !important;
      width: auto !important;
      overflow: visible !important;
      transform: none !important;
    `;

    // 创建提示内容
    const hintContent = document.createElement("div");
    hintContent.innerHTML = "右键双击恢复默认视角";
    hintContainer.appendChild(hintContent);

    // 直接添加到body中，确保在最顶层
    document.body.appendChild(hintContainer);
    this.element = hintContainer;

    // 确保元素可见
    console.log("SceneHint created:", hintContainer);

    // 强制显示一次，确保元素被正确渲染
    setTimeout(() => {
      if (this.element) {
        this.element.style.opacity = "1";
        this.isVisible = true;
        console.log("SceneHint force shown");
      }
    }, 100);
  }

  show(message) {
    if (this.element) {
      this.element.querySelector("div").innerHTML = message;
      this.element.style.opacity = "1";
      this.isVisible = true;
      console.log("SceneHint shown:", message);
    }
  }

  hide() {
    if (this.element && this.isVisible) {
      this.element.style.opacity = "0";
      this.isVisible = false;
      console.log("SceneHint hidden");
    }
  }

  updateMessage(message) {
    if (this.element) {
      this.element.querySelector("div").innerHTML = message;
      console.log("SceneHint message updated:", message);
    }
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    console.log("SceneHint destroyed");
  }
}
