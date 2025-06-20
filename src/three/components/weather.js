import * as THREE from "three";
import TWEEN from "three/examples/jsm/libs/tween.module";
import { Rain, Snow } from "../../lib/blMeshes";
import { Stars } from "../../lib/stars";
import Core from "../../main";
import { Postprocessing } from "./postprocessing";
import { changeLightingPattern } from "../../shader/funs";
import { loadTexture } from "../../utils/texture";

export const symbolWeather = Symbol();

const LEVEL = {
  1: 1000,
  2: 3000,
  3: 8000,
};

// weather
export const SUNNY = 0;
export const SNOW = 1;
export const RAIN = 2;

// lightingPattern
export const DAY = 4;
export const NIGHT = 8;
export const SCIENCE = 16;

const AMBIENT = "AmbientLight";
const DIRECTIONAL = "DirectionalLight";

const SUNNY_DAY = SUNNY | DAY;
const SUNNY_NIGHT = SUNNY | NIGHT;
const SNOW_DAY = SNOW | DAY;
const SNOW_NIGHT = SNOW | NIGHT;
const RAIN_DAY = RAIN | DAY;
const RAIN_NIGHT = RAIN | NIGHT;

export const SunnyTexture = loadTexture("./textures/sky/sunny.jpg");
const NightCloudyTexture = loadTexture("./textures/sky/night_cloudy.jpg");
const NightTexture = loadTexture("./textures/sky/night.jpg");
const CloudyTexture = loadTexture("./textures/sky/cloudy.jpg");

const TexturesMap = {
  [SUNNY_DAY]: SunnyTexture,
  [SUNNY_NIGHT]: NightTexture,
  [SNOW_DAY]: CloudyTexture,
  [SNOW_NIGHT]: NightCloudyTexture,
  [RAIN_DAY]: CloudyTexture,
  [RAIN_NIGHT]: NightCloudyTexture,
  [SCIENCE]: null,
};

const LightIntensityMap = {
  [SUNNY_DAY]: { [AMBIENT]: 1.25, [DIRECTIONAL]: 1.55 },
  [SUNNY_NIGHT]: { [AMBIENT]: 0.35, [DIRECTIONAL]: 0.2 },
  [SNOW_DAY]: { [AMBIENT]: 0.45, [DIRECTIONAL]: 0.3 },
  [SNOW_NIGHT]: { [AMBIENT]: 0.3, [DIRECTIONAL]: 0.15 },
  [RAIN_DAY]: { [AMBIENT]: 0.35, [DIRECTIONAL]: 0.1 },
  [RAIN_NIGHT]: { [AMBIENT]: 0.2, [DIRECTIONAL]: 0.15 },
  [SCIENCE]: { [AMBIENT]: 1.85, [DIRECTIONAL]: 0.25 },
};

const LightColorMap = {
  [DAY]: {
    [AMBIENT]: 0xffffff,
    [DIRECTIONAL]: 0xffffff,
    saturation: 0.08,
    contrast: 0.2,
  },
  [NIGHT]: {
    [AMBIENT]: 0xffffff,
    [DIRECTIONAL]: 0x79a7ff,
    saturation: 0.08,
    contrast: 0.12,
  },
  [SCIENCE]: {
    [AMBIENT]: 0x78b1ff,
    [DIRECTIONAL]: 0xffffff,
    saturation: 0,
    contrast: 0,
  }, //0x5d80e6
};

export class Weather {
  /** @param {Core} core */
  constructor(core) {
    console.log("Weather constructor called with core:", core);
    console.log("Weather constructor this:", this);

    /**@type {THREE.Scene} */
    this.scene = core.scene;
    console.log("Weather scene:", this.scene);

    /**@type {THREE.DirectionalLight} */
    this.directionalLight = core.directionalLight;

    /**@type {THREE.AmbientLight} */
    this.ambientLight = core.ambientLight;

    /**@type {Postprocessing} */
    this.postprocessing = core.postprocessing;

    /**@type {DAY|NIGHT|SCIENCE} */
    this.lightingPattern = DAY;

    this.onRenderQueue = core.onRenderQueue;

    this.rain = null;
    this.snow = null;

    // 初始化一个默认的包围盒，后续会被更新
    this.box = new THREE.Box3(
      new THREE.Vector3(-500, 0, -500),
      new THREE.Vector3(500, 500, 500)
    );

    this.thunderA = null;
    this.thunderB = null;

    this.weather = SUNNY;
    this.level = 3;

    // 确保使用正确的scene引用
    if (this.scene) {
      this.scene.backgroundRotation.setFromVector3(new THREE.Vector3(0, 0, 0));
    } else {
      console.error("Weather: scene is not properly initialized");
    }

    this.setToRenderQueue();
  }

  /**
   * 设置天气范围
   * @param {THREE.Box3} box
   */
  setBoundingBox(box) {
    if (!box) {
      console.warn("Weather: Invalid bounding box provided");
      return;
    }

    console.log("Updating weather bounds:", box);
    this.box.copy(box);

    // 如果当前有天气效果，需要重新创建以使用新的范围
    if (this.weather === RAIN) {
      this.setRainWeather(this.level);
    } else if (this.weather === SNOW) {
      this.setSnowWeather(this.level);
    }
  }

  deleteFromRenderQueue() {
    this.onRenderQueue.delete(symbolWeather);
  }

  setToRenderQueue() {
    this.onRenderQueue.set(symbolWeather, this.update);
  }

  /**
   * 设置天气
   * @param {SUNNY|SNOW|RAIN} weather
   * @param {Number} level
   */
  setWeather(weather, level = 3) {
    // 如果待设置天气与当前天气相同，直接返回
    if (this.equalWeather(weather, level)) return;

    // 科幻风没有天气
    if (this.lightingPattern === SCIENCE) return;

    // 检查scene是否正确初始化
    if (!this.scene) {
      console.error("Weather: scene is not properly initialized");
      return;
    }

    // 释放资源
    this.dispose();

    // 更新天气数据
    this.weather = weather;
    console.log("Current weather:", this.weather);
    this.level = level;

    this.setBackground();
    this.changeLightIntensity(this.ambientLight);
    this.changeLightIntensity(this.directionalLight);

    this.setShadow();
    if (weather === SNOW) {
      this.setSnowWeather(this.level);
    } else if (weather === SUNNY) {
      // nothing
    } else if (weather === RAIN) {
      this.setRainWeather(this.level);
    } else {
      console.error("不存在的天气");
    }
  }

  /**
   * 判断是否相同天气类型和大小
   * @param {SUNNY|SNOW|RAIN} weather
   * @param {Number} level
   */
  equalWeather(weather, level) {
    return this.weather === weather && this.level === level;
  }

  /**
   * 设置雪天
   * @param {number} level
   */
  setSnowWeather(level) {
    try {
      // 先清理现有的雪花效果
      if (this.snow) {
        this.snow.deleteSelf();
        this.snow = null;
      }

      const count = LEVEL[level];
      // 根据包围盒大小动态调整雪花数量，但设置上限
      const boxSize = this.box.getSize(new THREE.Vector3());
      const volume = boxSize.x * boxSize.y * boxSize.z;
      const baseCount = Math.floor(count * (volume / 1000000));
      // 增加最大雪花数量以提高密度
      const maxSnowflakes = 8000;
      const adjustedCount = Math.min(baseCount, maxSnowflakes);

      console.log("Creating snow effect with count:", adjustedCount);

      this.snow = new Snow(this.box, {
        count: adjustedCount,
        speed: 0.12, // 进一步降低雪花下落速度
        size: Math.min(8, boxSize.y / 100), // 进一步减小雪花大小
      });

      if (this.snow && this.scene) {
        this.scene._add(this.snow);
        console.log("Snow effect added to scene successfully");
      } else {
        console.error("Failed to create or add snow effect");
      }
    } catch (error) {
      console.error("Error setting snow weather:", error);
      // 确保清理资源
      if (this.snow) {
        this.snow.deleteSelf();
        this.snow = null;
      }
    }
  }

  /**
   * 设置雨天
   * @param {number} level
   */
  setRainWeather(level) {
    try {
      // 先清理现有的雨滴效果
      if (this.rain) {
        this.rain.deleteSelf();
        this.rain = null;
      }

      if (level === 3) this.createThunder();

      const count = LEVEL[level];
      this.rain = new Rain(this.box, {
        count,
        speed: 1,
        size: 2.5, // 增大雨滴大小
      });

      if (this.rain && this.scene) {
        this.scene._add(this.rain);
        console.log("Rain effect added to scene successfully");
      } else {
        console.error("Failed to create or add rain effect");
      }
    } catch (error) {
      console.error("Error setting rain weather:", error);
      // 确保清理资源
      if (this.rain) {
        this.rain.deleteSelf();
        this.rain = null;
      }
    }
  }

  setStars() {
    const count = 2000;
    const range = new THREE.Box3(
      new THREE.Vector3(-4800, -4800, -4800),
      new THREE.Vector3(4800, 4800, 4800)
    );
    this.stars = new Stars(count, range);
    this.scene._add(this.stars);
  }

  /**获取天气*/
  getWeatherBit() {
    return this.lightingPattern === SCIENCE
      ? SCIENCE
      : this.weather | this.lightingPattern;
  }

  /**
   * 获取当前天气中的灯光强度
   * @param {THREE.Light} light
   */
  getLightIntensity(light) {
    if (!LightIntensityMap[this.getWeatherBit()]) {
      LightIntensityMap[this.getWeatherBit()] = {
        [AMBIENT]: 0.35,
        [DIRECTIONAL]: 0.1,
      };
    }
    return LightIntensityMap[this.getWeatherBit()][light.type];
  }

  /**设置当天天气风格下的背景贴图 */
  setBackground() {
    if (!this.scene) {
      console.error("Weather: scene is not properly initialized");
      return;
    }
    const texture = TexturesMap[this.getWeatherBit()];
    if (!texture) {
      console.error(
        "Weather: invalid texture for weather bit:",
        this.getWeatherBit()
      );
      return;
    }
    this.scene.background = texture;
    this.scene.needsUpdate = true; // 确保场景更新
    console.log("Background texture set to:", texture);
  }

  /**
   * 设置当前天气中的灯光颜色
   * @param {THREE.Light} light
   */
  setLightColor(light) {
    light.color.set(LightColorMap[this.lightingPattern][light.type]);
  }

  /**设置当前天气风格下的阴影 */
  setShadow() {
    const weatherBit = this.getWeatherBit();
    this.directionalLight.castShadow = !(
      weatherBit & RAIN || weatherBit & NIGHT
    );
  }

  /**设置白天的灯光 */
  resetComposer(lightingPattern = DAY) {
    this.postprocessing.hueSaturationEffect.saturation =
      LightColorMap[lightingPattern].saturation;
    this.postprocessing.brightnessContrastEffect.contrast =
      LightColorMap[lightingPattern].contrast;
  }

  /**
   * 日夜景切换
   * @param {DAY|NIGHT|SCIENCE} lightingPattern
   */
  updateLightingPattern(lightingPattern) {
    // 目标设置与当前设置相同则直接返回
    if (this.lightingPattern === lightingPattern) return;
    console.log(
      "切换光照模式:",
      lightingPattern,
      lightingPattern === NIGHT
        ? "NIGHT"
        : lightingPattern === DAY
        ? "DAY"
        : lightingPattern
    );
    this.lightingPattern = lightingPattern;

    // 释放资源
    this.dispose();

    // 设置阴影
    this.setShadow();

    if (lightingPattern !== SCIENCE) {
      // 如果不是科技风,设置当前天气
      if (this.weather === RAIN) {
        this.setRainWeather(this.level);
      } else if (this.weather === SNOW) {
        this.setSnowWeather(this.level);
      }
    } else {
      // 科技风为满天星辰
      this.setStars();
    }

    // 设置背景图
    this.setBackground();
    console.log("背景贴图:", this.scene, this.scene.background);

    // 设置光照强度
    this.changeLightIntensity(this.ambientLight);
    this.changeLightIntensity(this.directionalLight);

    // 设置光照颜色
    this.setLightColor(this.ambientLight);
    this.setLightColor(this.directionalLight);
    console.log(
      "环境光:",
      this.ambientLight.color,
      "强度:",
      this.ambientLight.intensity
    );
    console.log(
      "平行光:",
      this.directionalLight.color,
      "强度:",
      this.directionalLight.intensity
    );

    // 设置对比度和饱和度
    this.postprocessing.hueSaturationEffect.saturation =
      LightColorMap[lightingPattern].saturation;
    this.postprocessing.brightnessContrastEffect.contrast =
      LightColorMap[lightingPattern].contrast;

    changeLightingPattern(lightingPattern);

    // --- 强制设置，排查被覆盖问题 ---
    this.scene.background = TexturesMap[this.getWeatherBit()];
    this.ambientLight.color.set(LightColorMap[lightingPattern][AMBIENT]);
    this.directionalLight.color.set(
      LightColorMap[lightingPattern][DIRECTIONAL]
    );
    this.ambientLight.intensity =
      LightIntensityMap[this.getWeatherBit()][AMBIENT];
    this.directionalLight.intensity =
      LightIntensityMap[this.getWeatherBit()][DIRECTIONAL];
    console.log("[强制] 背景:", this.scene.background);
    console.log(
      "[强制] 环境光:",
      this.ambientLight.color,
      "强度:",
      this.ambientLight.intensity
    );
    console.log(
      "[强制] 平行光:",
      this.directionalLight.color,
      "强度:",
      this.directionalLight.intensity
    );
  }

  /**
   * 根据当前天气风格改变灯光强度
   * @param {THREE.Light} light
   */
  changeLightIntensity(light) {
    new TWEEN.Tween(light)
      .to({ intensity: this.getLightIntensity(light) }, 1000)
      .start();
  }

  createThunder() {
    const light = this.ambientLight;
    this.cleanThunder();
    this.thunderA = new TWEEN.Tween(light)
      .to({ intensity: 3 }, 200)
      .repeat(2)
      .yoyo()
      .onComplete(() => {
        this.resetThunder();
      });
    this.thunderB = new TWEEN.Tween(light)
      .to({ intensity: this.getLightIntensity(light) }, 300)
      .onComplete(() => {
        this.resetThunder();
      });
    this.timer = setTimeout(() => {
      if (this.thunderA) {
        this.thunderA.start();
      }
      clearTimeout(this.timer);
      this.timer = null;
    }, 5000);
  }

  resetThunder() {
    const light = this.ambientLight;
    new TWEEN.Tween(light)
      .to(
        { intensity: LightIntensityMap[this.getWeatherBit()][light.type] },
        1000
      )
      .start();
    const num = Math.ceil(Math.random() * 10 + 20) * 1000;
    this.timer = setTimeout(() => {
      const d = Math.random();
      if (d > 0.5) {
        this.thunderB && this.thunderB.start();
      } else {
        this.thunderA && this.thunderA.start();
      }
      clearTimeout(this.timer);
      this.timer = null;
    }, num);
  }

  cleanThunder() {
    if (this.thunderA) {
      this.thunderA.stop();
      this.thunderA = null;
      this.thunderB.stop();
      this.thunderB = null;
    }
  }

  /**@param {core} core */
  update = (core) => {
    this.rain && this.rain.update(core.delta, core.camera.position);
    this.snow && this.snow.update();
    this.stars && this.stars.update();
  };
  dispose() {
    this.cleanThunder();

    if (this.rain) {
      try {
        this.rain.deleteSelf();
      } catch (error) {
        console.error("Error disposing rain:", error);
      }
      this.rain = null;
    }

    if (this.snow) {
      try {
        this.snow.deleteSelf();
      } catch (error) {
        console.error("Error disposing snow:", error);
      }
      this.snow = null;
    }

    if (this.stars) {
      try {
        this.stars.deleteSelf();
      } catch (error) {
        console.error("Error disposing stars:", error);
      }
      this.stars = null;
    }
  }

  /**
   * 切换场景天气
   * @param {Object} options 天气配置选项
   * @param {string} options.type 天气类型: 'sunny' | 'night' | 'rain' | 'snow'
   * @param {number} [options.level=3] 天气强度等级: 1-3
   * @param {boolean} [options.withThunder=false] 是否开启雷电效果(仅雨天有效)
   */
  switchWeather(options) {
    console.log("switchWeather called with options:", options);
    console.log("switchWeather this:", this);
    console.log("switchWeather this.scene:", this.scene);

    const { type, level = 3, withThunder = false } = options;

    // 检查是否与当前状态相同
    const currentWeatherBit = this.getWeatherBit();
    const targetLightingPattern = type === "night" ? NIGHT : DAY;
    const targetWeatherType =
      type === "rain" ? RAIN : type === "snow" ? SNOW : SUNNY;
    const targetWeatherBit = targetWeatherType | targetLightingPattern;

    if (currentWeatherBit === targetWeatherBit && this.level === level) {
      console.log("Weather state unchanged, skipping update");
      return;
    }

    let weatherType;
    let lightingPattern;

    switch (type) {
      case "sunny":
        weatherType = SUNNY;
        lightingPattern = DAY;
        break;
      case "night":
        weatherType = SUNNY;
        lightingPattern = NIGHT;
        break;
      case "rain":
        weatherType = RAIN;
        lightingPattern = DAY;
        break;
      case "snow":
        weatherType = SNOW;
        lightingPattern = DAY;
        break;
      default:
        console.error("不支持的天气类型:", type);
        return;
    }

    console.log("Selected weather type:", weatherType);
    console.log("Selected lighting pattern:", lightingPattern);

    // 先切换光照模式（黑夜/白天），再切换天气
    this.updateLightingPattern(lightingPattern);
    this.setWeather(weatherType, level);

    if (type === "rain" && withThunder) {
      this.createThunder();
    }

    // 强制更新场景
    if (this.scene) {
      this.scene.needsUpdate = true;
      // 确保背景贴图被正确应用
      const texture = TexturesMap[this.getWeatherBit()];
      if (texture) {
        this.scene.background = texture;
        console.log("Forced background update:", texture);
      }
    }
  }
}
