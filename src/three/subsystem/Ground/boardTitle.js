import { createCSS2DObject, createCSS3DSprite } from "../../../lib/CSSObject";

export const createBuildingNameLabel = (
  innerText,
  onSingleClick,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave
) => {
  let labelEle = document.createElement("div");
  let labelEleOut = document.createElement("div");
  labelEleOut.append(labelEle);
  labelEleOut.draggable = false;
  labelEleOut.className = "beilu_three_Board_text_person";
  labelEle.innerText = innerText;
  let css2d = createCSS2DObject(labelEleOut);

  // Support both single and double click
  let clickTimer = null;
  labelEle.onclick = (e) => {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    clickTimer = setTimeout(() => {
      if (onSingleClick) onSingleClick(css2d, e);
      clickTimer = null;
    }, 250);
  };
  labelEle.ondblclick = (e) => {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    if (onDoubleClick) onDoubleClick(css2d, e);
  };

  // 添加鼠标悬停事件
  if (onMouseEnter) {
    labelEle.onmouseenter = (e) => {
      onMouseEnter(css2d, e);
    };
  }
  if (onMouseLeave) {
    labelEle.onmouseleave = (e) => {
      onMouseLeave(css2d, e);
    };
  }

  return css2d;
};

export const createBuildingInfoLabel = (innerText, visible = false) => {
  let labelEle = document.createElement("div");
  let labelEleOut = document.createElement("div");
  labelEleOut.append(labelEle);
  labelEleOut.draggable = false;
  labelEleOut.className = "buildingNum";
  labelEle.innerText = innerText;
  let css2d = createCSS2DObject(labelEleOut);
  css2d.visible = visible;

  return css2d;
};
