export function add(a, b) {
  return a + b;
}

export function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 2);
}