import Core from "../main";
import {
  doFenceData,
  equipData,
  inspectionData,
  personDangerData,
  gatherDangerDate,
  sceneChange,
  searchData,
  realTimeData,
  dangerHistoryData,
} from "../three/components/dataProgress";
import {
  SUNNY,
  RAIN,
  SNOW,
  DAY,
  NIGHT,
  SCIENCE,
} from "../three/components/weather";

// 因为管控部分版本没有更新，所以需要这个映射表
const TransformMap = {
  sunny: "SUNNY",
  rain: "RAIN",
  snow: "SNOW",
  day: "DAY",
  night: "NIGHT",
  science: "SCIENCE",
};

export const onMessage = async () => {
  // 动态导入所需的模块
  const [
    { SUNNY, RAIN, SNOW, DAY, NIGHT, SCIENCE },
    {
      doFenceData,
      equipData,
      inspectionData,
      personDangerData,
      gatherDangerDate,
      sceneChange,
      searchData,
      realTimeData,
      dangerHistoryData,
    },
  ] = await Promise.all([
    import("../three/components/weather"),
    import("../three/components/dataProgress"),
  ]);

  // 更新 TransformMap 的值
  Object.keys(TransformMap).forEach((key) => {
    TransformMap[key] = eval(TransformMap[key]);
  });

  // 等待 Store3D 实例初始化
  const waitForStore3D = () => {
    return new Promise((resolve) => {
      const checkStore3D = () => {
        if (window.Core) {
          resolve(window.Core);
        } else {
          setTimeout(checkStore3D, 100);
        }
      };
      checkStore3D();
    });
  };

  // 等待 Store3D 实例初始化完成
  const core = await waitForStore3D();

  window.addEventListener("message", (event) => {
    if (!core) {
      console.warn("Store3D 实例尚未初始化");
      return;
    }

    if (event.data && event.data.cmd) {
      switch (event.data.cmd) {
        case "changeWeather": {
          const param = event.data.param;
          if (!param || !param.type) {
            console.warn("无效的天气参数:", param);
            return;
          }
          core.ground.switchWeather({ type: param.type, level: param.level });
          break;
        }
        case "changeSystem": {
          core.changeSystem(event.data.param);
          break;
        }
        case "changeIndoor": {
          core.changeIndoor(event.data.param);
          break;
        }
      }
    }
  });
};
