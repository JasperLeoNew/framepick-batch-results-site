# FramePick Batch Results

FramePick 批处理结果静态档案站。用于查看批次完成状态、成功/失败统计、槽位分布、候选终判和单模板详情。

## 本地运行

要求 Node.js 22.13+：

```bash
npm install
npm run dev
```

验证：

```bash
npm run lint
npm test
npm run build
```

## 数据

- `public/data/results.json`：批次元数据与模板结果。
- `public/data/images/`：结果页面引用的压缩候选帧。
- `app/page.tsx`：档案页面、过滤器和详情弹窗。

从 Photo 核心工作区导出新的静态包：

```bash
python scripts/export_framepick_batch_site.py \
  --run-dir capcut_auto_runs/<run> \
  --ids-file <template-ids.txt> \
  --site-dir framepick-batch-results-site
```

导出脚本位于 `photo-project-core` 仓库。不要提交 `node_modules`、构建输出或本地 Wrangler 状态。
