"use client";

import {
  ArrowDownUp,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  ImageOff,
  Layers3,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Counts = {
  total: number;
  metadata: number;
  extracted: number;
  llm: number;
  completed: number;
  yes: number;
  no: number;
  unjudgeable: number;
  pending: number;
  metadataFailed: number;
  ruleRejected: number;
};

type Candidate = {
  label: string;
  candidateId: string;
  image: string;
  time: number;
  effectiveSlots: number;
  distributionScore: number;
};

type ResultItem = {
  id: string;
  title: string;
  status: string;
  decision: "Y" | "N" | "U" | "";
  source: string;
  reason: string;
  ruleLabel: string;
  ruleDecision: string;
  ruleScore: number;
  confidence: number;
  riskLevel: string;
  riskTags: string[];
  bestCandidate: string;
  bestImage: string;
  candidates: Candidate[];
  metrics: {
    effectiveSlots: number;
    placeholders: number;
    textCount: number;
    stickerCount: number;
    distributionScore: number;
    layoutSpread: number;
    collageVariant: number;
    selectedTime: number;
  };
  slotQuality: string;
  slotReason: string;
  slotAnalysis: {
    valid_photo_slot_count?: number;
    replaceable_photo_slot_count?: number;
    fake_or_merged_slot_count?: number;
    has_independent_slots?: boolean;
    slots?: Array<Record<string, unknown>>;
  };
  detailError: string;
  extractError: string;
};

type BatchPayload = {
  batch: {
    id: string;
    status: "processing" | "completed";
    updatedAt: string;
    counts: Counts;
  };
  items: ResultItem[];
};

const emptyCounts: Counts = {
  total: 0,
  metadata: 0,
  extracted: 0,
  llm: 0,
  completed: 0,
  yes: 0,
  no: 0,
  unjudgeable: 0,
  pending: 0,
  metadataFailed: 0,
  ruleRejected: 0,
};

const filterOptions = [
  { key: "all", label: "全部" },
  { key: "Y", label: "收录" },
  { key: "N", label: "不收录" },
  { key: "U", label: "不可判断" },
  { key: "pending", label: "处理中" },
] as const;

function decisionLabel(decision: ResultItem["decision"]) {
  if (decision === "Y") return "收录";
  if (decision === "N") return "不收录";
  if (decision === "U") return "不可判断";
  return "处理中";
}

function sourceLabel(source: string) {
  if (source === "llm") return "视觉终判";
  if (source === "rule") return "规则终判";
  if (source === "metadata") return "元数据";
  if (source === "extract") return "抽帧";
  return "等待终判";
}

function percent(value: number) {
  if (!Number.isFinite(value)) return "0";
  return `${Math.round(value * 100)}%`;
}

export default function Home() {
  const [payload, setPayload] = useState<BatchPayload | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filterOptions)[number]["key"]>("all");
  const [sort, setSort] = useState("input");
  const [visibleCount, setVisibleCount] = useState(60);
  const [selected, setSelected] = useState<ResultItem | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await fetch(`/data/results.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("结果数据暂不可用");
      const next = (await response.json()) as BatchPayload;
      setPayload(next);
      setError("");
      setSelected((current) =>
        current ? next.items.find((item) => item.id === current.id) ?? null : null,
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "结果数据暂不可用");
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (payload?.batch.status !== "processing") return;
    const timer = window.setInterval(() => void loadData(), 30000);
    return () => window.clearInterval(timer);
  }, [loadData, payload?.batch.status]);

  useEffect(() => {
    setVisibleCount(60);
  }, [filter, query, sort]);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [selected]);

  const counts = payload?.batch.counts ?? emptyCounts;
  const completion = counts.total ? counts.completed / counts.total : 0;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = (payload?.items ?? []).filter((item) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "pending"
            ? !item.decision
            : item.decision === filter;
      const matchesSearch =
        !normalized ||
        item.id.includes(normalized) ||
        item.title.toLowerCase().includes(normalized) ||
        item.reason.toLowerCase().includes(normalized);
      return matchesFilter && matchesSearch;
    });
    return list.sort((a, b) => {
      if (sort === "confidence") return b.confidence - a.confidence;
      if (sort === "score") return b.ruleScore - a.ruleScore;
      if (sort === "slots") return b.metrics.effectiveSlots - a.metrics.effectiveSlots;
      return (payload?.items.indexOf(a) ?? 0) - (payload?.items.indexOf(b) ?? 0);
    });
  }, [filter, payload?.items, query, sort]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="FramePick 批次结果首页">
          <span className="brand-mark">F</span>
          <span>FramePick Archive</span>
        </a>
        <div className="topbar-actions">
          <span className={`run-status ${payload?.batch.status ?? "processing"}`}>
            <span className="status-dot" />
            {payload?.batch.status === "completed" ? "批次已完成" : "批次运行中"}
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label="复制页面链接"
            title="复制页面链接"
            onClick={copyLink}
          >
            {copied ? <Check size={17} /> : <Copy size={17} />}
          </button>
        </div>
      </header>

      <section className="overview" id="top">
        <div className="overview-copy">
          <p className="eyebrow">{payload?.batch.id ?? "FRAMEPICK BATCH"}</p>
          <h1>500 个模板的拼图候选终判</h1>
          <p className="summary-copy">
            多轨解析、候选抽帧、槽位复核与视觉模型结论，集中在同一份可检索档案中。
          </p>
        </div>
        <div className="completion-block">
          <div className="completion-value">{Math.round(completion * 100)}%</div>
          <div className="completion-meta">
            <span>{counts.completed} / {counts.total} 已终判</span>
            <span>
              {payload?.batch.updatedAt
                ? new Date(payload.batch.updatedAt).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "等待数据"}
            </span>
          </div>
          <div className="progress-track" aria-label={`完成 ${Math.round(completion * 100)}%`}>
            <span style={{ width: `${completion * 100}%` }} />
          </div>
        </div>
      </section>

      <section className="metrics-band" aria-label="批次数据概览">
        <div className="metric yes">
          <span>收录</span>
          <strong>{counts.yes}</strong>
        </div>
        <div className="metric no">
          <span>不收录</span>
          <strong>{counts.no}</strong>
        </div>
        <div className="metric unknown">
          <span>不可判断</span>
          <strong>{counts.unjudgeable}</strong>
        </div>
        <div className="metric pending">
          <span>处理中</span>
          <strong>{counts.pending}</strong>
        </div>
        <div className="metric quiet">
          <span>规则直接拦截</span>
          <strong>{counts.ruleRejected}</strong>
        </div>
        <div className="metric quiet">
          <span>视觉模型已处理</span>
          <strong>{counts.llm}</strong>
        </div>
      </section>

      <section className="results-section">
        <div className="toolbar">
          <div className="search-field">
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索模板 ID、标题或结论"
              aria-label="搜索结果"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="清空搜索"
                title="清空搜索"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
          <div className="filter-tabs" role="tablist" aria-label="结论筛选">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={filter === option.key}
                className={filter === option.key ? "active" : ""}
                onClick={() => setFilter(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="sort-control">
            <ArrowDownUp size={16} aria-hidden="true" />
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="input">输入顺序</option>
              <option value="confidence">模型置信度</option>
              <option value="score">规则分数</option>
              <option value="slots">有效槽位数</option>
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
        </div>

        <div className="results-heading">
          <div>
            <h2>模板结果</h2>
            <span>{filtered.length} 条</span>
          </div>
          <div className="legend" aria-label="结论图例">
            <span><i className="legend-y" />收录</span>
            <span><i className="legend-n" />不收录</span>
            <span><i className="legend-u" />不可判断</span>
          </div>
        </div>

        {error ? <div className="empty-state">{error}</div> : null}

        <div className="result-grid">
          {filtered.slice(0, visibleCount).map((item) => (
            <button
              className="result-card"
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
            >
              <div className="result-image">
                {item.bestImage ? (
                  <img src={item.bestImage} alt={`模板 ${item.id} 最佳候选帧`} loading="lazy" />
                ) : (
                  <div className="image-placeholder">
                    {item.decision ? <ImageOff size={26} /> : <Clock3 size={26} />}
                  </div>
                )}
                <span className={`decision-badge decision-${item.decision || "pending"}`}>
                  {decisionLabel(item.decision)}
                </span>
                {item.bestCandidate ? (
                  <span className="candidate-badge">候选 {item.bestCandidate}</span>
                ) : null}
              </div>
              <div className="result-body">
                <div className="result-title-row">
                  <strong>{item.id}</strong>
                  <span>{sourceLabel(item.source)}</span>
                </div>
                <p>{item.reason || item.title || "等待处理结果"}</p>
                <div className="card-metrics">
                  <span><Layers3 size={14} /> {item.metrics.effectiveSlots} 槽位</span>
                  <span>规则 {item.ruleScore}</span>
                  {item.confidence ? <span>置信 {percent(item.confidence)}</span> : null}
                </div>
              </div>
            </button>
          ))}
        </div>

        {!error && filtered.length === 0 ? (
          <div className="empty-state">没有符合当前条件的结果</div>
        ) : null}

        {visibleCount < filtered.length ? (
          <button
            className="load-more"
            type="button"
            onClick={() => setVisibleCount((count) => count + 60)}
          >
            加载更多
            <span>{Math.min(visibleCount, filtered.length)} / {filtered.length}</span>
          </button>
        ) : null}
      </section>

      {selected ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <section
            className="result-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="dialog-header">
              <div>
                <span className={`decision-badge decision-${selected.decision || "pending"}`}>
                  {decisionLabel(selected.decision)}
                </span>
                <h2 id="dialog-title">{selected.id}</h2>
                <p>{selected.title || sourceLabel(selected.source)}</p>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setSelected(null)}
                aria-label="关闭详情"
                title="关闭详情"
              >
                <X size={20} />
              </button>
            </header>

            <div className="dialog-content">
              <div className="dialog-visuals">
                <div className="best-frame">
                  {selected.bestImage ? (
                    <img src={selected.bestImage} alt={`模板 ${selected.id} 最佳候选帧`} />
                  ) : (
                    <div className="image-placeholder"><ImageOff size={32} /></div>
                  )}
                </div>
                {selected.candidates.length ? (
                  <div className="candidate-strip">
                    {selected.candidates.map((candidate) => (
                      <figure key={`${selected.id}-${candidate.label}-${candidate.candidateId}`}>
                        {candidate.image ? (
                          <img src={candidate.image} alt={`候选 ${candidate.label}`} loading="lazy" />
                        ) : (
                          <div className="image-placeholder"><ImageOff size={18} /></div>
                        )}
                        <figcaption>
                          <strong>{candidate.label}</strong>
                          <span>{candidate.effectiveSlots} 槽位</span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : null}
              </div>

              <aside className="dialog-analysis">
                <section>
                  <div className="section-label"><SlidersHorizontal size={15} />终判</div>
                  <p className="dialog-reason">{selected.reason || "等待终判"}</p>
                  <dl className="facts">
                    <div><dt>来源</dt><dd>{sourceLabel(selected.source)}</dd></div>
                    <div><dt>规则标签</dt><dd>{selected.ruleLabel || "—"}</dd></div>
                    <div><dt>规则分数</dt><dd>{selected.ruleScore}</dd></div>
                    <div><dt>模型置信度</dt><dd>{selected.confidence ? percent(selected.confidence) : "—"}</dd></div>
                    <div><dt>风险等级</dt><dd>{selected.riskLevel || "—"}</dd></div>
                    <div><dt>最佳候选</dt><dd>{selected.bestCandidate || "—"}</dd></div>
                  </dl>
                </section>

                <section>
                  <div className="section-label"><Layers3 size={15} />画面与槽位</div>
                  <dl className="facts">
                    <div><dt>有效槽位</dt><dd>{selected.metrics.effectiveSlots}</dd></div>
                    <div><dt>占位素材</dt><dd>{selected.metrics.placeholders}</dd></div>
                    <div><dt>独立可替换</dt><dd>{selected.slotAnalysis.replaceable_photo_slot_count ?? "—"}</dd></div>
                    <div><dt>疑似合并槽</dt><dd>{selected.slotAnalysis.fake_or_merged_slot_count ?? "—"}</dd></div>
                    <div><dt>布局扩散</dt><dd>{selected.metrics.layoutSpread}</dd></div>
                    <div><dt>拼贴变化</dt><dd>{selected.metrics.collageVariant}</dd></div>
                    <div><dt>画面评分</dt><dd>{selected.metrics.distributionScore}</dd></div>
                    <div><dt>抽帧时间</dt><dd>{selected.metrics.selectedTime}s</dd></div>
                  </dl>
                  {selected.slotReason ? <p className="slot-reason">{selected.slotReason}</p> : null}
                </section>

                {selected.riskTags.length ? (
                  <section>
                    <div className="section-label">风险标签</div>
                    <div className="tag-list">
                      {selected.riskTags.map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  </section>
                ) : null}
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
