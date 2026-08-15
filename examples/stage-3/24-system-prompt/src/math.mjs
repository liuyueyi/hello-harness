export function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 2);
}

console.log("factorial(5) =", factorial(5));
console.log("factorial(1) =", factorial(1));
