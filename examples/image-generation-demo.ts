/**
 * 图像生成模型示例
 * 运行: node --import tsx --env-file-if-exists=.env examples/image-generation-demo.ts
 */

import { createOpenAIImageModel } from "@hello-harness/ai";

async function main() {
  // 创建图像生成模型，使用 agnes-image-2.1-flash
  const imageModel = createOpenAIImageModel("agnes-image-2.1-flash");
  
  console.log(`使用模型: ${imageModel.modelName}`);
  console.log("");
  
  // 生成图像
  const prompt = "A minimalist logo for a coding agent harness project";
  console.log(`提示词: ${prompt}`);
  
  const urls = await imageModel.generate(prompt, {
    n: 1,           // 生成 1 张
    size: "1024x1024",
    quality: "standard",
  });
  
  console.log("");
  console.log("生成的图像 URL:");
  for (const url of urls) {
    console.log(`  ${url}`);
  }
}

main().catch(console.error);
