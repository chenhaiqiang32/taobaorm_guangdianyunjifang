import { Vector3, Raycaster } from "three";
import Core from "../../../main";

let ray = new Raycaster();

// 等待 Core 初始化完成的函数
const waitForCore = () => {
  return new Promise((resolve) => {
    if (Core) {
      resolve(Core);
    } else {
      const checkCore = setInterval(() => {
        if (Core) {
          clearInterval(checkCore);
          resolve(Core);
        }
      }, 100);
    }
  });
};

export const getCurrentPosition = async (data, needRay) => {
  // 等待 Core 初始化完成
  const core = await waitForCore();

  // needRay是否需要射线检测
  // 获取当前位置信息
  const { coordinate, originId, sceneType } = data;
  // 获取当前位置属性
  let { x, y, z } = coordinate;
  [z, y] = [y, z]; // 接口给的参数反的
  let getPosition = new Vector3(x, y, z);

  if (sceneType === 0) {
    // 室内
    let dwFloor = core.dwObj[originId]; //  定位模型位置
    if (!dwFloor) return { x: 0, y: 0, z: 0 };
    let relPosition = new Vector3();

    const dwPosition = dwFloor.getWorldPosition(new Vector3());

    relPosition.x = getPosition.x / 100 + dwPosition.x;
    relPosition.y = dwPosition.y;
    relPosition.z = getPosition.z / 100 + dwPosition.z;
    let name = originId + "_DM";
    let floor = core.dwObj[name]; // 地面模型

    if (floor) {
      ray.set(
        new Vector3(relPosition.x, relPosition.y + 100, relPosition.z),
        new Vector3(0, -1, 0)
      );
      const intersects = ray.intersectObject(floor);
      if (intersects.length) {
        relPosition.y = intersects[0].point.y;
      }
    }

    return relPosition;
  }
  if (sceneType === 1) {
    // 室外
    let relPosition = new Vector3(getPosition.x / 100, 0, getPosition.z / 100);
    // todo 文件包含地面模型简模时需要做地面检测
    let ground = core.ground["groundMesh"]; // 地面模型

    if (ground) {
      ray.set(
        new Vector3(relPosition.x, relPosition.y + 100, relPosition.z),
        new Vector3(0, -1, 0)
      );
      const intersects = ray.intersectObject(ground);
      if (intersects.length) {
        relPosition.y = intersects[0].point.y;
      }
    }

    return relPosition;
  }
};
