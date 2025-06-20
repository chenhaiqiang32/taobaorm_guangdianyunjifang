// 使用单例模式
class Store3DSingleton {
  constructor() {
    if (Store3DSingleton.instance) {
      return Store3DSingleton.instance;
    }
    Store3DSingleton.instance = this;
    this.core = null;
    this.initialized = false;
  }

  async init(canvas) {
    if (this.initialized) {
      console.log("Store3D 已经初始化");
      return;
    }

    try {
      console.log("开始初始化 Store3D...");
      // 动态导入 Store3D
      const { Store3D } = await import("./three/index");
      this.core = new Store3D(canvas);
      await this.core.init();

      // 将 Core 实例挂载到 window 上，方便调试
      window.Core = this.core;
      this.initialized = true;

      // 动态导入并调用 onMessage
      const { onMessage } = await import("./message/onMessage");
      await onMessage();

      console.log("Store3D 初始化完成");
    } catch (error) {
      console.error("初始化 Store3D 失败:", error);
      this.core = null;
      this.initialized = false;
      throw error;
    }
  }

  get instance() {
    if (!this.initialized || !this.core) {
      console.warn("Store3D 实例尚未初始化");
      return null;
    }
    return this.core;
  }
}

// 创建单例实例
const store3D = new Store3DSingleton();

// 确保 DOM 加载完成后再初始化
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.querySelector("canvas");
  if (!canvas) {
    console.error("找不到 canvas 元素");
    return;
  }

  store3D.init(canvas).catch((error) => {
    console.error("初始化失败:", error);
  });
});

// 导出单例实例
export default store3D;
