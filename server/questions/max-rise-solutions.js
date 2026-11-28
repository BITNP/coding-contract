const c = `#include <stdio.h>
int main(void) {
  int n, previous, value, length = 1, best = 1;
  scanf("%d%d", &n, &previous);
  while (--n > 0) {
    scanf("%d", &value);
    length = value > previous ? length + 1 : 1;
    if (length > best) best = length;
    previous = value;
  }
  printf("%d\\n", best);
  return 0;
}`

const javascript = `const values = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number)
let streak = 1, best = 1
for (let i = 2; i < values.length; i++) {
  streak = values[i] > values[i - 1] ? streak + 1 : 1
  best = Math.max(best, streak)
}
console.log(best)`

export default {
  c,
  cpp: c,
  javascript,
  typescript: javascript,
  python: `import sys
values = map(int, sys.stdin.buffer.read().split())
next(values)
previous = next(values)
best = length = 1
for value in values:
  length = length + 1 if value > previous else 1
  best = max(best, length)
  previous = value
print(best)`,
  java: `import java.util.Scanner;
public class Main {
  public static void main(String[] args) {
    Scanner in = new Scanner(System.in);
    int n = in.nextInt(), previous = in.nextInt(), length = 1, best = 1;
    for (int i = 1; i < n; i++) {
      int value = in.nextInt();
      length = value > previous ? length + 1 : 1;
      best = Math.max(best, length);
      previous = value;
    }
    System.out.println(best);
  }
}`,
  go: `package main
import ("bufio"; "fmt"; "os")
func main() {
  in := bufio.NewReader(os.Stdin)
  var n, previous, value int
  fmt.Fscan(in, &n, &previous)
  length, best := 1, 1
  for i := 1; i < n; i++ {
    fmt.Fscan(in, &value)
    if value > previous { length++ } else { length = 1 }
    if length > best { best = length }
    previous = value
  }
  fmt.Println(best)
}`,
  rust: `use std::io::{self, Read};
fn main() {
  let mut input = String::new();
  io::stdin().read_to_string(&mut input).unwrap();
  let mut values = input.split_whitespace().skip(1).map(|s| s.parse::<i32>().unwrap());
  let mut previous = values.next().unwrap();
  let (mut length, mut best) = (1, 1);
  for value in values {
    length = if value > previous { length + 1 } else { 1 };
    best = best.max(length);
    previous = value;
  }
  println!("{}", best);
}`,
  csharp: `using System;
class MainClass {
  static void Main() {
    var a = Console.In.ReadToEnd().Split((char[])null, StringSplitOptions.RemoveEmptyEntries);
    int previous = int.Parse(a[1]), length = 1, best = 1;
    for (int i = 2; i < a.Length; i++) {
      int value = int.Parse(a[i]);
      length = value > previous ? length + 1 : 1;
      best = Math.Max(best, length);
      previous = value;
    }
    Console.WriteLine(best);
  }
}`,
  kotlin: `fun main() {
  val input = java.util.Scanner(System.\`in\`)
  val n = input.nextInt()
  var previous = input.nextInt()
  var length = 1
  var best = 1
  repeat(n - 1) {
    val value = input.nextInt()
    length = if (value > previous) length + 1 else 1
    best = maxOf(best, length)
    previous = value
  }
  println(best)
}`,
  swift: `import Foundation
let input = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8)!
let values = input.split { $0.isWhitespace }.dropFirst().map { Int($0)! }
var length = 1, best = 1
for (a, b) in zip(values, values.dropFirst()) {
  length = b > a ? length + 1 : 1
  best = max(best, length)
}
print(best)`,
  php: `<?php
$a = preg_split('/\\s+/', trim(stream_get_contents(STDIN)));
$length = $best = 1;
for ($i = 2; $i < count($a); $i++) {
  $length = (int)$a[$i] > (int)$a[$i - 1] ? $length + 1 : 1;
  $best = max($best, $length);
}
echo $best, PHP_EOL;`,
  ruby: `values = STDIN.read.split.drop(1).map(&:to_i)
length = best = 1
values.each_cons(2) do |a, b|
  length = b > a ? length + 1 : 1
  best = [best, length].max
end
puts best`,
  lua: `local n, previous = io.read("*n", "*n")
local length, best = 1, 1
for i = 2, n do
  local value = io.read("*n")
  length = value > previous and length + 1 or 1
  best = math.max(best, length)
  previous = value
end
print(best)`,
  perl: `use strict;
use warnings;
my @values = split ' ', do { local $/; <STDIN> };
shift @values;
my $previous = shift @values;
my ($length, $best) = (1, 1);
for my $value (@values) {
  $length = $value > $previous ? $length + 1 : 1;
  $best = $length if $length > $best;
  $previous = $value;
}
print "$best\\n";`,
  r: `values <- scan(file("stdin"), quiet = TRUE)[-1]
length_run <- 1
best <- 1
previous <- values[1]
for (value in values[-1]) {
  length_run <- if (value > previous) length_run + 1 else 1
  best <- max(best, length_run)
  previous <- value
}
cat(format(best, scientific = FALSE), "\\n")`,
  bash: `read -r n
read -r -d '' data
length=0 best=0 previous=0
for value in $data; do
  (( length = value > previous ? length + 1 : 1,
     best = length > best ? length : best,
     previous = value ))
done
printf '%s\\n' "$best"`,
}
