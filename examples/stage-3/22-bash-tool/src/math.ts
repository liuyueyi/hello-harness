/**
 * 计算一组数字的总和
 * @param numbers 数字数组
 * @returns 所有数字的总和
 */
function sum(...numbers: number[]): number {
    return numbers.reduce((total, num) => total + num, 0);
}

// 导出以便在其他模块中使用
export { sum };