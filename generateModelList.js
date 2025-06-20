import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取模型目录
const outdoorModelDir = path.join(__dirname, "public/models/outDoor");
const indoorModelDir = path.join(__dirname, "public/models/inDoor");
const outputFile = path.join(__dirname, "src/assets/modelList.js");

console.log("=== 开始生成模型列表 ===");
console.log("当前工作目录:", __dirname);
console.log("室外模型目录:", outdoorModelDir);
console.log("室内模型目录:", indoorModelDir);
console.log("输出文件:", outputFile);

try {
  // 确保目录存在
  if (!fs.existsSync(outdoorModelDir)) {
    console.error(`错误: 目录 ${outdoorModelDir} 不存在`);
    process.exit(1);
  }

  if (!fs.existsSync(indoorModelDir)) {
    console.error(`错误: 目录 ${indoorModelDir} 不存在`);
    process.exit(1);
  }

  // 读取目录内容
  const outdoorFiles = fs.readdirSync(outdoorModelDir);
  const indoorFiles = fs.readdirSync(indoorModelDir);

  console.log("室外模型目录中的所有文件:", outdoorFiles);
  console.log("室内模型目录中的所有文件:", indoorFiles);

  // 过滤出 .glb 文件
  const outdoorModelFiles = outdoorFiles.filter((file) =>
    file.endsWith(".glb")
  );
  const indoorModelFiles = indoorFiles.filter((file) => file.endsWith(".glb"));

  // 提取室内模型名称（_前面的部分）
  const buildingNames = indoorModelFiles.map((file) => file.split("_")[0]);

  if (outdoorModelFiles.length === 0) {
    console.warn("警告: 没有找到室外 .glb 文件");
  }

  if (indoorModelFiles.length === 0) {
    console.warn("警告: 没有找到室内 .glb 文件");
  }

  // 生成 JavaScript 文件内容
  const content = `// 这个文件是自动生成的，请勿手动修改
// 生成时间: ${new Date().toLocaleString()}
export const modelFiles = ${JSON.stringify(outdoorModelFiles, null, 2)};

// 室内模型对应的建筑名称列表
export const buildingNames = ${JSON.stringify(buildingNames, null, 2)};
`;

  // 确保输出目录存在
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    console.log("创建输出目录:", outputDir);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 写入文件
  fs.writeFileSync(outputFile, content);

  console.log("✅ 模型列表已生成到:", outputFile);
  console.log("📋 找到的室外模型文件:", outdoorModelFiles);
  console.log("📋 找到的室内模型文件:", indoorModelFiles);
  console.log("📋 提取的建筑名称:", buildingNames);
  console.log("=== 模型列表生成完成 ===");
} catch (error) {
  console.error("❌ 生成模型列表时出错:", error);
  console.error("错误详情:", error.stack);
  process.exit(1);
}
