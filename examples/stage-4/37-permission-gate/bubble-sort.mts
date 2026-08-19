import { calculator } from "../../../src/tools/calculator";

/**
 * 冒泡排序算法实现
 * @param arr 待排序的数组
 * @returns 排序后的数组
 */
function bubbleSort<T>(arr: T[]): T[] {
    const n = arr.length;
    const result = [...arr]; // 创建数组副本，避免修改原数组
    
    // 外层循环控制排序轮数
    for (let i = 0; i < n - 1; i++) {
        // 内层循环进行相邻元素比较和交换
        for (let j = 0; j < n - i - 1; j++) {
            // 如果前面的元素大于后面的元素，则交换它们
            if (result[j] > result[j + 1]) {
                // 使用解构赋值进行交换
                [result[j], result[j + 1]] = [result[j + 1], result[j]];
            }
        }
    }
    
    return result;
}

/**
 * 生成随机数组用于测试
 * @param length 数组长度
 * @param maxValue 最大值
 * @returns 随机数组
 */
function generateRandomArray(length: number, maxValue: number = 100): number[] {
    const arr: number[] = [];
    for (let i = 0; i < length; i++) {
        arr.push(Math.floor(Math.random() * maxValue));
    }
    return arr;
}

/**
 * 打印数组
 * @param arr 要打印的数组
 */
function printArray<T>(arr: T[], label: string = ""): void {
    if (label) {
        console.log(label);
    }
    console.log(arr.join(", "));
}

/**
 * 验证数组是否已排序
 * @param arr 要验证的数组
 * @returns 是否已排序
 */
function isSorted<T>(arr: T[]): boolean {
    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] > arr[i + 1]) {
            return false;
        }
    }
    return true;
}

// 测试冒泡排序算法
console.log("=== 冒泡排序算法测试 ===");

// 测试1：简单数组
const testArray1 = [64, 34, 25, 12, 22, 11, 90];
console.log("\n测试1 - 简单数组：");
console.log("排序前：", testArray1.join(", "));
const sorted1 = bubbleSort(testArray1);
console.log("排序后：", sorted1.join(", "));
console.log("验证排序结果：", isSorted(sorted1) ? "✓ 正确" : "✗ 错误");

// 测试2：随机数组
const testArray2 = generateRandomArray(10, 50);
console.log("\n测试2 - 随机数组：");
console.log("排序前：", testArray2.join(", "));
const sorted2 = bubbleSort(testArray2);
console.log("排序后：", sorted2.join(", "));
console.log("验证排序结果：", isSorted(sorted2) ? "✓ 正确" : "✗ 错误");

// 测试3：已排序数组
const testArray3 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
console.log("\n测试3 - 已排序数组：");
console.log("排序前：", testArray3.join(", "));
const sorted3 = bubbleSort(testArray3);
console.log("排序后：", sorted3.join(", "));
console.log("验证排序结果：", isSorted(sorted3) ? "✓ 正确" : "✗ 错误");

// 测试4：逆序数组
const testArray4 = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
console.log("\n测试4 - 逆序数组：");
console.log("排序前：", testArray4.join(", "));
const sorted4 = bubbleSort(testArray4);
console.log("排序后：", sorted4.join(", "));
console.log("验证排序结果：", isSorted(sorted4) ? "✓ 正确" : "✗ 错误");

// 测试5：包含重复元素的数组
const testArray5 = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
console.log("\n测试5 - 包含重复元素的数组：");
console.log("排序前：", testArray5.join(", "));
const sorted5 = bubbleSort(testArray5);
console.log("排序后：", sorted5.join(", "));
console.log("验证排序结果：", isSorted(sorted5) ? "✓ 正确" : "✗ 错误");

// 使用calculator工具计算排序后的数组长度
console.log("\n=== 使用calculator工具验证数组长度 ===");
const length1 = calculator({ expression: `${sorted1.length} + 0` });
const length2 = calculator({ expression: `${sorted2.length} + 0` });
const length3 = calculator({ expression: `${sorted3.length} + 0` });
const length4 = calculator({ expression: `${sorted4.length} + 0` });
const length5 = calculator({ expression: `${sorted5.length} + 0` });

console.log(`数组1长度：${length1.value}`);
console.log(`数组2长度：${length2.value}`);
console.log(`数组3长度：${length3.value}`);
console.log(`数组4长度：${length4.value}`);
console.log(`数组5长度：${length5.value}`);

console.log("\n=== 冒泡排序算法特性 ===");
console.log("时间复杂度：");
console.log("  最好情况：O(n) - 当数组已经有序时");
console.log("  平均情况：O(n²)");
console.log("  最坏情况：O(n²) - 当数组完全逆序时");
console.log("空间复杂度：O(1) - 原地排序算法");
console.log("稳定性：稳定 - 相等元素的相对位置保持不变");