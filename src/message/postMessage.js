
export const postOnLoaded = () => {
  window.parent.postMessage(
    {
      // 三维结束模型加载
      cmd: "onLoaded",
    },
    "*"
  );
};
export const postFirstLoad = () => {
  window.parent.postMessage(
    {
      // 三维结束模型加载
      cmd: "firstLoad",
    },
    "*"
  );
};
