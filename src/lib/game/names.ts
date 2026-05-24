import type { Locale, RandomSource } from "./types";

const zhNames = [
  "星图零一",
  "矩阵七号",
  "深空巡官",
  "晨雾节点",
  "轨道审计",
  "蓝移协议",
  "银环观察",
  "棱镜代理",
  "信标三号",
  "熵减书记"
];

const enNames = [
  "Star Map 01",
  "Matrix Seven",
  "Deep Orbit",
  "Dawn Node",
  "Audit Relay",
  "Blue Shift",
  "Silver Ring",
  "Prism Agent",
  "Beacon Three",
  "Entropy Clerk"
];

export function generateAiNames(
  count: number,
  locale: Locale,
  rng: RandomSource = Math.random,
) {
  const source = locale === "zh-CN" ? zhNames : enNames;
  const shuffled = [...source].sort(() => rng() - 0.5);
  return shuffled.slice(0, count);
}
