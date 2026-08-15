/**
 * 冒泡排序（Bubble Sort）
 * 
 * 通过重复遍历数组，依次比较相邻元素并交换顺序错误的元素，
 * 直到没有需要交换的元素为止。
 * 
 * @param arr 待排序的数组
 * @returns 排序后的数组（原地排序，原数组被修改）
 */
export function bubbleSort(arr: number[]): number[] {
  const n = arr.length;
  
  // 外层循环控制遍历轮数
  for (let i = 0; i < n - 1; i++) {
    // 优化标志：如果某一轮没有发生交换，说明数组已有序
    let swapped = false;
    
    // 内层循环进行相邻元素比较
    // 每轮结束后，最大的元素会"冒泡"到数组末尾
    for (let j = 0; j < n - 1 - i; j++) {
      if (arr[j] > arr[j + 1]) {
        // 交换相邻元素
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        swapped = true;
      }
    }
    
    // 如果没有发生交换，提前结束排序
    if (!swapped) break;
  }
  
  return arr;
}