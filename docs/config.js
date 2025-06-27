/** Global Configs */
window.configs = {
  websocket: "ws://172.23.57.52:9999/gis/gis/websocket/client", //人员定位数据websocket地址
  floorToName: {
    "1楼_室内": {
      "4c": "中心数据机房",
    },
    "2楼_室内": {
      "2-1c": "无线发射机房",
      "1-1c": "UPS机房",
    },
    柴油发电机房_室内: {
      "1c": "柴油发电机房",
    },
  },
};
window.floorToName = {
  中心数据机房: {
    path: "inDoor/1楼_室内",
    floor: "4c",
  },
  无线发射机房: {
    path: "inDoor/2楼_室内",
    floor: "2-1c",
  },
  UPS机房: {
    path: "inDoor/2楼_室内",
    floor: "1-1c",
  },
  柴油发电机房: {
    path: "inDoor/柴油发电机房_室内",
    floor: "1c",
  },
};
