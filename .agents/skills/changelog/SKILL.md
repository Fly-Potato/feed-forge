---
name: changelog
description: >
  当用户要求更新、修改或询问某个 changelog 文件时使用。支持用户指定的 changelog 路径；用于日常维护未发布变更，要求只处理 Unreleased，保持现有中文章节格式，不修改已发布版本。
---

# CHANGELOG 维护指南

## 目标

维护用户指定的 changelog 文件的未发布内容，保持和现有格式一致。

## 规则

- 参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 的基本格式，但以仓库现有中文章节风格为准。
- 如果目标 changelog 文件不存在，先创建它，再写入 `## [Unreleased]`。
- 只改 `## [Unreleased]`。
- 不修改已发布版本条目，除非用户明确要求。
- 按目标 changelog 文件现有章节风格写入：优先沿用文件里已有的 `### ...` 分组名称。
- 如果目标是子项目的 changelog，先确认该子项目的作用范围，只记录该子项目相关的变更，不要混入其他模块或仓库根级变更。
- 先检查同类条目是否已经存在；存在则合并补充，不重复添加。
- 以 git 历史为准：新增或更新 changelog 前，先从相关 commit / diff 归纳变更，再写入对应 changelog，不凭记忆猜测。
- 如果 `Unreleased` 不存在，先创建它，再写入当前变更类型。
- 保持条目简短、具体，描述结果，不写过程。

## 操作顺序

1. 读取用户指定的 changelog 文件。
2. 确认 `Unreleased` 是否存在。
3. 找到对应的变更类型分组。
4. 去重并合并已有条目。
5. 仅提交与该 changelog 相关的改动。






