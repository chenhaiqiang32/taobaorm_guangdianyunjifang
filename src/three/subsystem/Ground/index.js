import * as THREE from "three";
import { CustomSystem } from "../customSystem";
import { loadGLTF } from "../../loader";
import { buildingMap } from "../../../assets/buildingMap";
import { EscapeRoutePlate } from "./../../components/gather/escapeRouteLine";

import { Store3D } from "../..";
import {
  dblclickBuilding,
  getBuildingDetail,
  getPerson,
  postBuildingId,
} from "../../../message/postMessage";
import { SunnyTexture, Weather } from "../../components/weather";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { createInstanceMesh } from "../../../lib/InstanceMesh";
import { getBoxCenter } from "../../../lib/box3Fun";
import { createBuildingInfoLabel, createBuildingNameLabel } from "./boardTitle";

import EquipmentPlate from "../../components/business/equipMentPlate";
import { MeasureDistance } from "../../components/measureDistance";

import { MeasureArea } from "../../components/measureArea";
import { FencePlate } from "../../components/business/fencePlate/fence";
import {
  autoRotate,
  processingCameraAnimation,
} from "../../processing/modelProcess";
import { modelProcess } from "../../processing";
import { GatherOrSilentFence } from "../../components/business/fencePlate/gatherOrSilentFence";
import { MeetingPointPlate } from "../../components/business/equipMentPlate/meetingPoint";
import { modelFiles, buildingNames } from "../../../assets/modelList";
import { Tooltip } from "../../components/Tooltip";
import { SceneHint } from "../../components/SceneHint";

// 动画管理器
class AnimationManager {
  constructor() {
    this.mixer = null;
    this.actions = new Map();
    this.clock = new THREE.Clock();
    this.isPlaying = false;
  }

  init(mixer) {
    this.mixer = mixer;
    this.clock.start();
  }

  addAction(name, action) {
    if (action) {
      this.actions.set(name, action);
      action.setLoop(THREE.LoopRepeat);
      action.clampWhenFinished = true;
    }
  }

  play(name) {
    const action = this.actions.get(name);
    if (action) {
      action.reset();
      action.play();
      this.isPlaying = true;
    }
  }

  stop(name) {
    const action = this.actions.get(name);
    if (action) {
      action.stop();
      this.isPlaying = false;
    }
  }

  update() {
    if (this.mixer && this.isPlaying) {
      this.mixer.update(this.clock.getDelta());
    }
  }
}

// 获取模型文件列表
async function getModelFiles() {
  try {
    const response = await fetch("/models/outDoor");
    const files = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(files, "text/html");
    const links = Array.from(doc.getElementsByTagName("a"));

    return links
      .map((link) => link.href)
      .filter((href) => href.endsWith(".glb"))
      .map((href) => href.split("/").pop());
  } catch (error) {
    console.error("Error fetching model files:", error);
    return [];
  }
}

export const ground = Symbol();
const fenceSymbol = Symbol();

const center = new THREE.Vector3();
const CAMERA_SPHERE = new THREE.Sphere(center, 2880);
const CONTROLS_SPHERE = new THREE.Sphere(center, 2880);

/**@type {OrbitControls} */
const controlsParameters = {
  maxPolarAngle: Math.PI / 2,
};

/**@classdesc 地面广场子系统 */
export class Ground extends CustomSystem {
  /** @param {Store3D} core*/
  constructor(core) {
    super(core);

    this.tweenControl = core.tweenControl;
    this.scene.background = SunnyTexture;
    this.onRenderQueue = core.onRenderQueue;
    this.controls = core.controls;
    this.baseCamera = core.baseCamera;
    this.camera = core.camera;
    this.orientation = core.orientation;

    this.boxSelect = core.orientation.boxSelect;
    this.postprocessing = core.postprocessing;

    this.outBuildingGroup = new THREE.Group();
    this.outBuildingGroup.name = "outBuildingGroup";
    this._add(this.outBuildingGroup);
    this.buildingMeshArr = [];
    this.buildingMeshObj = {};
    this.buildingNames = buildingNames;

    this.bloomLights = [];
    this.buildingNameLabelMap = {};
    this.buildingNum = {};
    this.singleBuildingGroup = {};
    this.labelGroup = new THREE.Group();
    this.labelGroup.name = "labelGroupHome";
    this._add(this.labelGroup);

    this.groundMesh = null;
    this.fencePlate = null;
    this.gatherOrSilentPlate = null;
    this.eventClear = [];
    this.pointerArr = [];
    this.isLoaded = false;
    this.searchBuildingId = null;

    this.roamEnabled = false;
    this.roamDuration = 10;
    this.filterBuildingArr = ["buildingBoard"];
    this.boxSelectStatus = false;

    this.instancedMesh = [];
    this.altitude = -20;
    this.modelList = [];
    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);
    this.loadedModels = new Map();

    // 初始化动画管理器
    this.animationManager = new AnimationManager();

    // 初始化提示框
    this.tooltip = new Tooltip();
    this.labelGroup.add(this.tooltip.css2dObject);

    // 初始化场景提示
    this.sceneHint = new SceneHint();

    this.init();
  }

  async init() {
    console.log("Ground system initializing...");
    try {
      // 创建模型配置数组
      const modelConfigs = modelFiles.map((modelFile) => ({
        name: modelFile.replace(".glb", ""),
        path: `./models/outDoor/${modelFile}`,
        type: ".glb",
      }));

      console.log("Loading models with configs:", modelConfigs);
      this.initLight();
      // 使用 loadGLTF 加载模型
      await loadGLTF(
        modelConfigs,
        (gltf, name) => {
          if (!gltf || !gltf.scene) {
            console.error(`❌ 模型加载失败: ${name} - 无效的模型数据`);
            return;
          }
          console.log(`✅ 成功加载模型: ${name}`);
          this.onProgress(gltf, name);
        },
        () => {
          console.log("✅ 所有模型加载完成");
          this.onLoaded();
        }
      );

      // 初始化各个组件
      this.fencePlate = new FencePlate(this.scene, this);
      this.escapeRoute = new EscapeRoutePlate(this.scene, this);
      this.gatherOrSilentPlate = new GatherOrSilentFence(this.scene, this);
      this.meetingPoint = new MeetingPointPlate(this.scene, this);

      console.log("Creating Weather instance with this:", this);
      console.log("Ground scene:", this.scene);
      this.weather = new Weather(this);
      console.log("Weather instance created:", this.weather);

      this.measureDistance = new MeasureDistance(this);
      this.measureArea = new MeasureArea(this);

      // 设置渲染队列
      if (this.core && this.core.onRenderQueue) {
        this.core.onRenderQueue.set(ground, this.update.bind(this));

        if (this.gatherOrSilentPlate) {
          this.core.onRenderQueue.set(
            "gatherOrSilentFence",
            this.gatherOrSilentPlate.update.bind(this.gatherOrSilentPlate)
          );
        }

        if (this.escapeRoute) {
          this.core.onRenderQueue.set(
            "escapeRoute",
            this.escapeRoute.update.bind(this.escapeRoute)
          );
        }
      }

      // 移除 loading 状态
      this.isLoaded = true;
      this.onLoaded();
    } catch (error) {
      console.error("❌ 加载模型时出错:", error);
      // 显示更详细的错误信息
      if (error.response) {
        console.error("响应状态:", error.response.status);
        console.error("响应头:", error.response.headers);
      }
      throw error;
    }
  }

  limitCameraInSphere = () => {
    if (this.controls.enableRotate) {
      this.camera.position.clampSphere(CAMERA_SPHERE);
      this.controls.target.clampSphere(CONTROLS_SPHERE);

      this.camera.position.y =
        this.camera.position.y < this.altitude
          ? this.altitude
          : this.camera.position.y;
      this.controls.target.y =
        this.controls.target.y < this.altitude
          ? this.altitude
          : this.controls.target.y;
    } else {
      // const radius = CAMERA_SPHERE.radius;
      // this.camera.position.y = this.camera.position.y >= radius ? radius : this.camera.position.y;
      // this.camera.position.y = this.camera.position.y <= -radius ? -radius : this.camera.position.y;
    }
  };

  handleControls() {
    this.controls.addEventListener("change", this.limitCameraInSphere);
    Reflect.ownKeys(controlsParameters).forEach((key) => {
      this.controls.data[key] = this.controls[key];
      this.controls[key] = controlsParameters[key];
    });
  }

  resetControls() {
    this.controls.removeEventListener("change", this.limitCameraInSphere);
    Reflect.ownKeys(controlsParameters).forEach((key) => {
      this.controls[key] = this.controls.data[key];
    });
  }

  setCameraState(state) {
    if (!this.useCameraState) return;

    const { begin, updateCameraState, stop } = this.useCameraState();

    /**更新相机漫游 */
    updateCameraState(this.roamDuration);

    /**开启或结束相机漫游 */
    if (state && this.core.currentSystem === this) {
      begin();
    } else {
      stop();
    }
  }

  addEventListener() {
    if (this.eventClear.length > 0) return; // eventClear队列大于0说明已经绑定过事件s

    // 正常状态下事件绑定
    let dblclick = this.core.raycast(
      "dblclick",
      this.buildingMeshArr,
      (intersects) => {
        if (intersects.length) {
          // 获取射线检测到的对象
          const intersectedMesh = intersects[0].object;
          // 向上查找父级，直到找到建筑模型
          let current = intersectedMesh;
          while (
            current.parent &&
            !this.buildingNames.some((name) => current.name.includes(name))
          ) {
            current = current.parent;
          }

          if (
            !this.boxSelectStatus &&
            this.buildingNames.some((name) => current.name.includes(name))
          ) {
            dblclickBuilding(current.name.split("_")[0]); // 通知前端我们即将进入室内，前端借此关闭一些弹窗
            this.core.changeSystem(
              "indoorSubsystem",
              current.name.split("_")[0]
            );
          }
        }
      }
    );

    // this.core.raycast("click", this.groundMesh, (intersects) => {
    //   if (intersects.length) {
    //     console.log(intersects[0].point, "位置坐标");
    //   }
    // });

    this.addGroundEvent();
    let rightCancel = this.core.rightDblClickListener(() => {
      this.resetCamera();
    });
    this.eventClear.push(dblclick.clear);
    this.eventClear.push(rightCancel);

    Object.values(this.buildingNum).forEach((child) => {
      child.element.onclick = () => this.buildingNumClick(child.name);
    });

    const cameraLerpTo = this.core.raycast(
      "dblclick",
      this.groundMesh,
      (intersects) => {
        if (intersects.length && !this.boxSelectStatus) {
          this.tweenControl.lerpTo(
            intersects[0].point,
            50,
            1000,
            new THREE.Vector3(0, 10, 0)
          );
        }
      }
    );
    this.eventClear.push(cameraLerpTo.clear);
  }

  groundClickEvent(ray) {
    let buildingInserts = ray.intersectObjects(this.buildingMeshArr);
    if (buildingInserts.length) {
      const intersectedMesh = buildingInserts[0].object;
      if (intersectedMesh.userData.buildingName) {
        this.commonSearchBuilding(intersectedMesh.userData.buildingName);
      }
    }
  }

  addGroundEvent() {
    let cancel = this.core.addClickCustom(this.groundClickEvent.bind(this));
    let mousemove = this.core.raycast(
      "mousemove",
      this.buildingMeshArr,
      (intersects) => {
        // 过滤
        if ((this.core.elapsedTime * 10) & 1) return;

        if (intersects.length) {
          const intersectedMesh = intersects[0].object;

          // 检查是否是建筑的主模型
          if (intersectedMesh.userData.buildingName) {
            this.postprocessing.clearOutlineAll(1);
            const pickBuilding = this.buildingMeshObj[this.searchBuildingId];
            // 获取所有属于同一建筑的网格
            const buildingMeshes = this.buildingMeshArr.filter(
              (mesh) =>
                mesh.userData.buildingName ===
                intersectedMesh.userData.buildingName
            );

            if (buildingMeshes.length > 0) {
              this.postprocessing.addOutline(
                [...buildingMeshes, pickBuilding],
                1
              );
            }

            // 检查是否可以进入室内，如果可以则显示提示框
            const buildingName = intersectedMesh.userData.buildingName;
            if (
              this.buildingNames.some((name) => buildingName.includes(name))
            ) {
              // 计算提示框位置（在建筑上方）
              const position = new THREE.Vector3();
              intersectedMesh.getWorldPosition(position);
              position.y += 10; // 在建筑上方显示
              this.tooltip.show(position);
            }
          }
        } else {
          this.postprocessing.clearOutlineAll(1);
          if (this.searchBuildingId) {
            let pickBuilding = this.buildingMeshObj[this.searchBuildingId];
            this.postprocessing.addOutline(pickBuilding, 1);
          }
          // 隐藏提示框
          this.tooltip.hide();
        }
      }
    );
    let mousemovePointer = this.core.raycast(
      "mousemove",
      this.orientation.orientation3D.pointerArr,
      (intersects) => {
        if (intersects.length) {
          document.body.style.cursor = "pointer";
        } else {
          document.body.style.cursor = "auto";
        }
      }
    );
    // this.eventClear.push(cancel);
    this.eventClear.push(mousemovePointer.clear);
    this.eventClear.push(mousemove.clear);
  }

  onEnter() {
    // 北元版本 切换子场景时会重置composer饱和度亮度为白天的配置 切回主场景时需要重新更新原有设置
    this.weather && this.weather.resetComposer(this.weather.lightingPattern);

    this.handleControls();
    EquipmentPlate.onLoad(this, this.core); // 设备系统
    this.boxSelect.onLoad(this);
    this.filterBuildingNum(); // 每次进入都要调用一下筛选

    // 显示室外场景提示
    this.sceneHint.show("右键双击恢复默认视角");

    if (this.isLoaded) {
      return new Promise((res, rej) => {
        this.onLoaded();
        res();
      });
    } else {
      //模型首次加载
      this.isLoaded = true;

      this.onLoaded();
    }
  }

  initDangerFence(data) {
    this.fencePlate.initDangerFence(data);
  }
  hideBuildingLabel(id = this.searchBuildingId) {
    let closeId = id || this.searchBuildingId;
    if (!closeId) {
      return false;
    }
    // 隐藏楼栋牌子
    this.buildingNameLabelMap[closeId].visible = false;
    this.buildingNameLabelMap[closeId].element.style.display = "none";
    this.searchBuildingId = null;
    this.postprocessing.clearOutlineAll(1);
  }
  hideAllBuildingLabel() {
    Object.values(this.buildingNameLabelMap).map((child) => {
      child.visible = false;
      child.element.style.display = "none";
    });
    Object.values(this.buildingNum).forEach((child) => {
      child.traverse((res) => {
        res.visible = false;
        child.element.style.display = "none";
      });
    });
    this.searchBuildingId = null;

    // 隐藏提示框
    if (this.tooltip) {
      this.tooltip.hide();
    }
  }
  clearDangerFence() {
    this.fencePlate.clearDangerFence();
  }
  clearBuildingFence() {
    this.fencePlate.clearBuildingFence();
  }
  changeWeather(param) {
    this.weather.setWeather(param.type, param.level);
  }
  switchWeather(param) {
    this.weather.switchWeather(param);
  }
  updateLightingPattern(param) {
    this.weather.updateLightingPattern(param);
  }

  /**历史轨迹指令 */
  historyTrackCommand(param) {
    if (param.cmd === "trackInit") {
      this.orientation.orientation3D.hiddenAllPerson = true;
      this.orientation.updateModules();

      this.removeEventListener();
      this.postprocessing.clearOutlineAll();
    }
    if (param.cmd === "trackClear") {
      this.removeEventListener();

      if (!this.historyTrack.path) {
        this.addEventListener();
      }

      this.orientation.orientation3D.hiddenAllPerson = false;
      this.orientation.updateModules();
    }
    this.historyTrack.command(param);
  }
  /**开启测量功能,所有功能依赖当前系统 */
  startMeasuring() {
    this.removeEventListener();
    this.measureDistance.start();
  }
  /**移除测量功能,所有功能依赖当前系统 */
  removeMeasuring() {
    this.measureDistance.end();
    this.addEventListener();
    this.resetCamera();
  }
  /**开启测面积功能,所有功能依赖当前系统 */
  startMeasureArea() {
    this.removeEventListener();
    this.measureArea.start();
  }
  /**移除测面积功能,所有功能依赖当前系统 */
  removeMeasureArea() {
    this.measureArea.end();
    this.addEventListener();
    this.resetCamera();
  }
  changeBoxSelect(state) {
    this.boxSelectStatus = state;
    if (state) {
      this.removeEventListener();
      this.boxSelect.start();
    } else {
      this.boxSelect.end();
      this.addEventListener();
      this.resetCamera();
    }
  }

  searchBuilding(visible = true) {
    if (visible) {
      // 未建模的建筑不用通知显示前端牌子
      // 通知前端显示建筑弹窗
      getBuildingDetail(this.searchBuildingId);
    }
    let title = this.buildingNameLabelMap[this.searchBuildingId];
    this.boardClick(title); // 视角拉近建筑

    this.postprocessing.clearOutlineAll(1);
    let pickBuilding = this.buildingMeshObj[this.searchBuildingId];
    this.postprocessing.addOutline(pickBuilding, 1);
  }
  createFence(data) {
    this.fencePlate.create(data);
  }
  clearFence() {
    // 清空围栏
    this.fencePlate.dispose();
  }

  /**
   * @param {import("three/examples/jsm/loaders/GLTFLoader").GLTF} gltf
   * @param {import { buildingMap } from './../../../assets/buildingMap';
string} name
   * @returns
   */
  onProgress(gltf, name) {
    if (this.core.scene !== this.scene) return;
    const model = gltf.scene;

    if (name === "地面") {
      const { min, max } = getBoxCenter(model);
      this.altitude = min.y;

      // 让地面模型接受阴影
      model.traverse((child) => {
        if (child.isMesh) {
          child.receiveShadow = true;
        }
      });

      // 设置地面网格
      this.groundMesh = model;

      // 更新天气范围
      if (this.weather) {
        // 创建一个比地面模型稍大的包围盒，确保天气效果覆盖整个场景
        const padding = 100; // 添加一些边距
        const weatherBox = new THREE.Box3(
          new THREE.Vector3(min.x - padding, min.y, min.z - padding),
          new THREE.Vector3(max.x + padding, max.y + 500, max.z + padding)
        );
        this.weather.setBoundingBox(weatherBox);
      }
    }

    // 检查是否是建筑模型
    if (
      this.buildingNames &&
      this.buildingNames.some((buildingName) => name.includes(buildingName))
    ) {
      // 将建筑模型添加到场景
      model.name = name;
      this.outBuildingGroup.add(model);

      // 遍历模型的所有网格
      model.traverse((child) => {
        if (child.isMesh) {
          // 设置网格属性
          child.castShadow = true;
          child.receiveShadow = true;

          // 将网格添加到射线检测数组
          this.buildingMeshArr.push(child);
          this.buildingMeshObj[child.name] = child;

          // 设置网格的用户数据，标记它属于哪个建筑
          child.userData.buildingName = name;
        }
      });
      this.setBuildingBoard(model);
    }

    // 处理动画
    if (gltf.animations && gltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(model);
      this.animationManager.init(mixer);

      gltf.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        this.animationManager.addAction(clip.name, action);
      });

      // 自动播放第一个动画
      if (gltf.animations.length > 0) {
        this.animationManager.play(gltf.animations[0].name);
      }
    }

    this._add(model);
  }

  // 建筑材质克隆，用于独立每一栋建筑的材质
  materialClone(child, mList) {
    if (child.isMesh) {
      const name = child.material.name;
      if (!mList[name]) {
        const m = child.material.clone();
        mList[name] = m;
        child.material = m;
      } else {
        child.material = mList[name];
      }

      child.material.originTransparent = child.material.transparent;
    }
  }
  setBuildingBoard(group) {
    // 用于计算旋转中心的建筑
    const { center, max } = getBoxCenter(group);
    const currentPosition = new THREE.Vector3(center.x, max.y, center.z);
    const name = group.name;

    // 根据建筑编号，找到对应的建筑名称，创建建筑标识牌
    const buildingName = buildingMap[name];
    const nameLabel = createBuildingNameLabel(
      buildingName,
      // 单击：拉近视角
      (css2d) => {
        this.cameraMoveToBuildingTitle(name);
      },
      // 双击：切换进入室内
      (css2d) => {
        this.core.changeSystem("indoorSubsystem", name.split("_")[0]);
      },
      // 鼠标进入：显示提示框
      (css2d) => {
        if (
          this.buildingNames.some((buildingName) => name.includes(buildingName))
        ) {
          const position = css2d.position.clone();
          position.y += 5; // 在牌子稍微上方显示
          this.tooltip.show(position);
        }
      },
      // 鼠标离开：隐藏提示框
      (css2d) => {
        this.tooltip.hide();
      }
    );
    nameLabel.visible = true; // 默认显示
    nameLabel.position.copy(currentPosition);
    this.labelGroup.add(nameLabel);
    this.buildingNameLabelMap[name] = nameLabel;

    // 创建建筑信息标识牌，标识牌显示建筑内人员数量信息,人员信息为0时，隐藏该标识牌
    const infoLabel = createBuildingInfoLabel(0, false);
    infoLabel.position.copy(currentPosition);
    infoLabel.scale.set(0.2, 0.2, 0.2);
    infoLabel.name = name;
    this.labelGroup.add(infoLabel);
    this.buildingNum[name] = infoLabel;
  }
  setFilterBuilding(filterArray) {
    // 设置筛选
    this.filterBuildingArr.length = 0;
    this.filterBuildingArr = filterArray;
  }
  filterBuildingNum() {
    const visible = this.filterBuildingArr.includes("buildingBoard");
    Object.values(this.buildingNum).forEach((child) => {
      child.traverse((res) => {
        res.visible = visible;
        res.visible = parseInt(res.element.innerText) > 0 ? visible : false;
      });
    });
  }

  cameraMoveToBuildingTitle(id) {
    // 相机移动到建筑牌子
    this.commonSearchBuilding(id);
  }
  commonSearchBuilding(id) {
    console.log(id, "id");
    // this.core.clearSearch(); // 清除现有搜索条件
    this.searchBuildingId = id;
    this.searchBuilding();
    this.removeEventListener();
    this.addEventListener(); // 搜索楼栋的时候可以正常进入建筑内部
  }
  boardClick = (board) => {
    const offset = new THREE.Vector3(2, 2, 0);
    this.tweenControl.lerpTo(board.position, 20, 1000, offset);
  };

  buildingNumClick(id) {
    postBuildingId(id);
  }

  changeBuildingNumber(array) {
    // 修改建筑数字
    array.map((child) => {
      const { id, number } = child;
      if (!buildingMap[id] || !this.buildingNum[id]) return false;
      this.buildingNum[id].element.innerText = String(number);

      this.buildingNum[id].visible =
        number > 0 && this.filterBuildingArr.includes("buildingBoard");
    });
  }
  showSingleBuildingBoard(id) {
    // 显示单个建筑牌子
    Object.entries(this.buildingNameLabelMap).map(([key, value]) => {
      if (key === id) {
        value.visible = true;
      } else {
        value.visible = false;
      }
    });
  }

  onLeave() {
    this.weather.resetComposer();
    this.hideAllBuildingLabel(); // 离开时隐藏所有建筑牌子
    this.resetControls();
    this.setCameraState(false);
    this.core.onRenderQueue.delete(fenceSymbol);
    this.measureArea.end();
    this.measureDistance.end();
    this.boxSelect.end();
    this.removeEventListener();
    document.body.style.cursor = "auto";

    // 清理提示框
    if (this.tooltip) {
      this.tooltip.hide();
    }

    // 隐藏场景提示
    if (this.sceneHint) {
      this.sceneHint.hide();
    }

    console.log("离开地面广场系统");
  }
  onLoaded() {
    if (!this.useCameraState) {
      autoRotate(this);
    }

    if (this.roamEnabled) {
      this.setCameraState(true);
    }

    if (this.instancedMesh && this.instancedMesh.length > 0) {
      this.instancedMesh.forEach((mesh) => {
        if (mesh && mesh instanceof THREE.Object3D) {
          this._add(mesh);
        }
      });
    }

    console.log("All models loaded successfully");
    this.addEventListener();
    // ground场景正常流程镜头动画

    this.resetCamera(1500).then(() => {
      getPerson({
        // 通知前端切换了场景，前端推送设备数据
        sceneType: 1,
        originId: "",
      });
      if (this.core && this.core.crossSearch) {
        this.core.crossSearch.changeSceneSearch();
      }
      super.updateOrientation();
    }); // 镜头动画结束后执行事件绑定

    if (this.fencePlate) {
      this.core.onRenderQueue.set(
        fenceSymbol,
        this.fencePlate.update.bind(this.fencePlate)
      );
    }

    // 在模型加载完成设置测距和测面积模块的射线检测对象。
    if (this.measureArea && this.groundMesh) {
      this.measureArea.setRaycastObject(this.groundMesh);
    }
    if (this.boxSelect && this.groundMesh) {
      this.boxSelect.setRaycastObject(this.groundMesh);
    }
    if (this.measureDistance && this.groundMesh) {
      this.measureDistance.setRaycastObject(this.groundMesh);
    }
  }
  removeEventListener() {
    this.eventClear.forEach((clear) => clear());
    this.eventClear = [];
  }
  update() {
    // 更新动画
    this.animationManager.update();
  }

  /**
   * @param {THREE.Object3D} model
   * @param {()=>void} setAttribute 设置属性
   */
  loadInstancedModel(model, setAttribute, scale) {
    const group = new THREE.Group();

    const instanceMap = {};
    const instancePositionMap = {};
    const instanceRotationMap = {};

    const v = new THREE.Vector3();

    function setInstanceArray(child) {
      child.getWorldPosition(v);

      const key = child.name.split("_")[0];
      instancePositionMap[key] = instancePositionMap[key] || [];
      instancePositionMap[key].push(v.clone());

      // child.getWorldDirection(v);
      instanceRotationMap[key] = instanceRotationMap[key] || [];
      instanceRotationMap[key].push(child.rotation);
    }

    model.forEach((group) => {
      if (group.name.includes("zuobiao")) {
        group.traverse((child) => {
          setInstanceArray(child);
        });
      }
      if (group.name.includes("shili")) {
        group.children.forEach((ins) => {
          instanceMap[ins.name] = ins;
          if (ins.name.includes("shu")) {
            ins.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material = new THREE.MeshLambertMaterial({
                  map: child.material.map,
                });
                modelProcess(child, "树", this);
              }
            });
          }
        });
      }
    });

    Object.keys(instanceMap).forEach((key) => {
      const instance = instanceMap[key];

      let ins;

      if (key.indexOf("shu") !== -1) {
        ins = createInstanceMesh(
          instance,
          instancePositionMap[key],
          true,
          scale
        );
      } else {
        ins = createInstanceMesh(
          instance,
          instancePositionMap[key],
          instanceRotationMap[key],
          scale
        );
      }

      group.add(ins);
      if (ins instanceof THREE.Group) {
        ins.traverse(setAttribute);
      } else {
        setAttribute(ins);
      }
    });
    return group;
  }
  resetCamera(duration = 1000) {
    if (!this.groundMesh) {
      console.warn("地面模型未加载，无法重置相机");
      return Promise.resolve();
    }

    const { radius } = getBoxCenter(this.groundMesh);
    const center = new THREE.Vector3(0, 0, 0);
    const cameraPosition = new THREE.Vector3(
      center.x,
      center.y + radius / 4,
      center.z + radius * 0.68
    );
    const controlsTarget = center.clone();

    return new Promise((resolve, reject) => {
      if (
        cameraPosition.distanceTo(this.camera.position) < 5 &&
        controlsTarget.distanceTo(this.controls.target) < 5
      )
        resolve();

      this.tweenControl.changeTo({
        start: this.camera.position,
        end: cameraPosition,
        duration,
        onComplete: () => {
          this.controls.enabled = true;
          resolve();
        },
        onStart: () => {
          this.controls.enabled = false;
        },
      });

      this.tweenControl.changeTo({
        start: this.controls.target,
        end: controlsTarget,
        duration,
        onUpdate: () => {
          this.camera.lookAt(this.controls.target);
        },
      });
    });
  }
  initLight() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25); // 线性SRG
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.55);
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 3500;
    directionalLight.shadow.camera.right = 2500;
    directionalLight.shadow.camera.left = -2500;
    directionalLight.shadow.camera.top = 1600;
    directionalLight.shadow.camera.bottom = -1600;
    directionalLight.shadow.mapSize.width = Math.pow(2, 11);
    directionalLight.shadow.mapSize.height = Math.pow(2, 11);
    directionalLight.shadow.blurSamples = 8;

    directionalLight.shadow.radius = 1.15;
    directionalLight.shadow.bias = -0.0015;
    // directionalLight.shadow.radius = 1.1;
    // directionalLight.shadow.bias = 0.01;

    directionalLight.position.set(-800, 1300, 1000);
    directionalLight.castShadow = true;

    this.ambientLight = ambientLight;
    this._add(this.ambientLight);
    const ch = new THREE.CameraHelper(directionalLight.shadow.camera);
    const hp = new THREE.DirectionalLightHelper(directionalLight);
    this.directionalLight = directionalLight;
    this._add(this.directionalLight);

    const dir2 = new THREE.DirectionalLight(0xcccccc, 0.3);
    dir2.position.set(-150, 150, 0);
    // this._add(dir2);

    const dir3 = new THREE.DirectionalLight(0xffffff, 0.4);
    dir3.position.set(150, 100, 0);

    // this._add(dir3);
  }
  showAllBuildingLabel() {
    Object.values(this.buildingNameLabelMap).forEach((child) => {
      child.visible = true;
      child.element.style.display = "block";
    });
  }

  destroy() {
    // 清理提示框资源
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }

    // 清理场景提示资源
    if (this.sceneHint) {
      this.sceneHint.destroy();
      this.sceneHint = null;
    }
  }
}
