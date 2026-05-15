import { AlertTriangle, ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Sidebar } from '../components/sections/Sidebar';
import {
  AppLayout,
  Button,
  HeaderRow,
  HeaderText,
  Input,
  MutedText,
  PageSurface,
  SectionSubtitle,
  SectionTitle,
  Table,
  TableWrapper,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  UserMenu,
} from '../components/ui';
import {
  CATEGORY_DOT_COLORS,
  Callout,
  CategoryAmounts,
  CategoryBar,
  CategoryBudgetRow,
  CategoryCard,
  CategoryFooter,
  CategoryList,
  CategoryName,
  CategoryTop,
  ChartCard,
  ChartFrame,
  DetailedSection,
  Dot,
  FormGrid,
  MetricBlock,
  MetricLabel,
  MetricValue,
  MiniTrend,
  ModalActions,
  ModalBackdrop,
  ModalPanel,
  ModalTitle,
  MonthInput,
  OverviewCard,
  OverviewHeader,
  OverviewMetrics,
  OverviewTitle,
  Pill,
  PillTab,
  PillTabs,
  ProgressFill,
  ProgressMeta,
  ProgressTrack,
  SectionHead,
  StatusPill,
  SummaryCard,
  SummaryGrid,
  SummaryHint,
  SummaryLabel,
  SummaryValue,
  TrendTag,
  useBudgetPageState,
  ytdRangeLabel,
  type BudgetAssumptions,
} from '../features/budget';
import { formatAppCurrency } from '../format/currency';
import { spacing } from '../styles/tokens';

export const BudgetPage = (): JSX.Element => {
  const {
    loading,
    error,
    now,
    balanceNow,
    balanceDeltaYtd,
    projectedEnd,
    ytdIncCombined,
    ytdIncomingActual,
    ytdIncEstimate,
    ytdExp,
    viewYear,
    viewMonthIndex,
    monthPickerValue,
    onMonthPickerChange,
    totalBudgeted,
    totalSpentMonth,
    remainingBudget,
    usagePct,
    detailTab,
    setDetailTab,
    sortedRecentTx,
    monthlyBreakdownDetail,
    categoryTrendsTable,
    chartTab,
    setChartTab,
    chartRowsMonthly,
    yearTotals,
    categoryRows,
    openBudgetModal,
    budgetModalOpen,
    setBudgetModalOpen,
    draftAssumptions,
    setDraftAssumptions,
    draftCategoryBudgets,
    setDraftCategoryBudgets,
    onSaveBudgets,
    categories,
    monthKey,
  } = useBudgetPageState();

  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>Budget &amp; Forecast</SectionTitle>
            <SectionSubtitle>Track your budget, monitor spending, and forecast future balance.</SectionSubtitle>
          </HeaderText>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
            <Button type="button" $variant="accent" $weight="semibold" $elevation="accent" onClick={openBudgetModal}>
              + Set budget
            </Button>
            <UserMenu />
          </div>
        </HeaderRow>

        {loading ? <MutedText>Loading…</MutedText> : null}
        {error ? <MutedText>Error: {error.message}</MutedText> : null}

        <SummaryGrid>
          <SummaryCard $variant="accent">
            <SummaryLabel>Current balance</SummaryLabel>
            <SummaryValue>{formatAppCurrency(balanceNow)}</SummaryValue>
            <SummaryHint>
              {balanceDeltaYtd >= 0 ? '+' : ''}
              {formatAppCurrency(balanceDeltaYtd)} YTD cash flow
            </SummaryHint>
          </SummaryCard>
          <SummaryCard>
            <SummaryLabel>Projected (year end)</SummaryLabel>
            <SummaryValue>{formatAppCurrency(projectedEnd)}</SummaryValue>
            <SummaryHint>Based on income estimate &amp; spend trend</SummaryHint>
          </SummaryCard>
          <SummaryCard>
            <SummaryLabel>YTD income</SummaryLabel>
            <SummaryValue style={{ color: '#16a34a' }}>
              +{formatAppCurrency(ytdIncCombined)}
            </SummaryValue>
            <SummaryHint>
              {ytdRangeLabel(now)} · imported {formatAppCurrency(ytdIncomingActual)} + estimate{' '}
              {formatAppCurrency(ytdIncEstimate)}
            </SummaryHint>
          </SummaryCard>
          <SummaryCard>
            <SummaryLabel>YTD expenses</SummaryLabel>
            <SummaryValue style={{ color: '#dc2626' }}>-{formatAppCurrency(ytdExp)}</SummaryValue>
            <SummaryHint>{ytdRangeLabel(now)}</SummaryHint>
          </SummaryCard>
        </SummaryGrid>

        <OverviewCard>
          <OverviewHeader>
            <div>
              <OverviewTitle>Monthly budget overview</OverviewTitle>
              <MutedText style={{ marginTop: 4 }}>
                {new Date(viewYear, viewMonthIndex, 1).toLocaleString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </MutedText>
            </div>
            <MonthInput type="month" value={monthPickerValue} onChange={(e) => onMonthPickerChange(e.target.value)} />
          </OverviewHeader>
          <OverviewMetrics>
            <MetricBlock>
              <MetricLabel>Total budgeted</MetricLabel>
              <MetricValue>{formatAppCurrency(totalBudgeted)}</MetricValue>
            </MetricBlock>
            <MetricBlock>
              <MetricLabel>Total spent</MetricLabel>
              <MetricValue $tone="blue">{formatAppCurrency(totalSpentMonth)}</MetricValue>
            </MetricBlock>
            <MetricBlock>
              <MetricLabel>Remaining</MetricLabel>
              <MetricValue $tone={remainingBudget >= 0 ? 'green' : 'red'}>{formatAppCurrency(remainingBudget)}</MetricValue>
            </MetricBlock>
          </OverviewMetrics>
          <ProgressTrack>
            <ProgressFill $pct={usagePct} $over={remainingBudget < 0} />
          </ProgressTrack>
          <ProgressMeta>
            <span>{totalBudgeted > 0 ? `${usagePct.toFixed(1)}%` : '—'} of budget used</span>
            <span>{totalBudgeted <= 0 ? 'Set category budgets to track usage' : null}</span>
          </ProgressMeta>
        </OverviewCard>

        <DetailedSection>
          <SectionHead>
            <OverviewTitle style={{ margin: 0 }}>Detailed views</OverviewTitle>
            <PillTabs>
              <PillTab type="button" $active={detailTab === 'recent'} onClick={() => setDetailTab('recent')}>
                Recent transactions
              </PillTab>
              <PillTab type="button" $active={detailTab === 'months'} onClick={() => setDetailTab('months')}>
                Monthly breakdown
              </PillTab>
              <PillTab type="button" $active={detailTab === 'trends'} onClick={() => setDetailTab('trends')}>
                Category trends
              </PillTab>
            </PillTabs>
          </SectionHead>

          {detailTab === 'recent' ? (
            <TableWrapper>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th>Description</Th>
                    <Th>Flow</Th>
                    <Th>Category</Th>
                    <Th style={{ textAlign: 'right' }}>Amount</Th>
                    <Th style={{ textAlign: 'right' }}>Budget impact</Th>
                    <Th style={{ textAlign: 'right' }}>Remaining</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {sortedRecentTx.length === 0 ? (
                    <Tr>
                      <Td colSpan={7}>
                        <MutedText>No transactions in this month.</MutedText>
                      </Td>
                    </Tr>
                  ) : (
                    sortedRecentTx.map(({ expense, remaining }) => {
                      const isIn = expense.flow === 'Incoming';
                      return (
                        <Tr key={expense.id}>
                          <Td>{expense.transactionDate.slice(0, 10)}</Td>
                          <Td>{expense.title}</Td>
                          <Td>
                            <Pill>{isIn ? 'Incoming' : 'Outgoing'}</Pill>
                          </Td>
                          <Td>
                            <Pill>{expense.category}</Pill>
                          </Td>
                          <Td style={{ textAlign: 'right' }}>{formatAppCurrency(expense.amount)}</Td>
                          <Td
                            style={{
                              textAlign: 'right',
                              color: isIn ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {isIn ? '+' : '-'}
                            {formatAppCurrency(expense.amount)}
                          </Td>
                          <Td
                            style={{
                              textAlign: 'right',
                              fontWeight: 600,
                              color: remaining >= 0 ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {formatAppCurrency(remaining)}
                          </Td>
                        </Tr>
                      );
                    })
                  )}
                </Tbody>
              </Table>
            </TableWrapper>
          ) : null}

          {detailTab === 'months' ? (
            <TableWrapper>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Month</Th>
                    <Th style={{ textAlign: 'right' }}>Income</Th>
                    <Th style={{ textAlign: 'right' }}>Expenses</Th>
                    <Th style={{ textAlign: 'right' }}>Budget</Th>
                    <Th style={{ textAlign: 'right' }}>Variance</Th>
                    <Th style={{ textAlign: 'right' }}>Savings</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {monthlyBreakdownDetail.rows.map((row) => (
                    <Tr key={row.key}>
                      <Td>
                        {row.label} {viewYear}
                        {row.isProjected ? (
                          <MutedText as="span" style={{ marginLeft: 6, fontSize: 11 }}>
                            (projected)
                          </MutedText>
                        ) : null}
                      </Td>
                      <Td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                        +{formatAppCurrency(row.income)}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {row.expenses === null ? '—' : formatAppCurrency(row.expenses)}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {row.budget > 0 ? formatAppCurrency(row.budget) : '—'}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {row.variance === null ? (
                          '—'
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 4,
                              fontWeight: 600,
                              color: row.variance >= 0 ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {row.variance >= 0 ? (
                              <ArrowDownRight size={16} aria-hidden />
                            ) : (
                              <ArrowUpRight size={16} aria-hidden />
                            )}
                            {formatAppCurrency(Math.abs(row.variance))}
                          </span>
                        )}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {row.savings === null ? '—' : formatAppCurrency(row.savings)}
                      </Td>
                      <Td>
                        {row.status === 'under' ? (
                          <StatusPill $variant="under">Under budget</StatusPill>
                        ) : row.status === 'over' ? (
                          <StatusPill $variant="over">Over budget</StatusPill>
                        ) : (
                          <MutedText as="span">—</MutedText>
                        )}
                      </Td>
                    </Tr>
                  ))}
                  {monthlyBreakdownDetail.totals ? (
                    <Tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                      <Td>Total (actual)</Td>
                      <Td style={{ textAlign: 'right', color: '#16a34a' }}>
                        +{formatAppCurrency(monthlyBreakdownDetail.totals.income)}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {formatAppCurrency(monthlyBreakdownDetail.totals.expenses)}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {formatAppCurrency(monthlyBreakdownDetail.totals.budget)}
                      </Td>
                      <Td>—</Td>
                      <Td style={{ textAlign: 'right' }}>{formatAppCurrency(monthlyBreakdownDetail.totals.savings)}</Td>
                      <Td>—</Td>
                    </Tr>
                  ) : null}
                </Tbody>
              </Table>
            </TableWrapper>
          ) : null}

          {detailTab === 'trends' ? (
            categoryTrendsTable.rows.length === 0 ? (
              <MutedText>Add outgoing expenses to see category trends for {viewYear}.</MutedText>
            ) : (
              <TableWrapper>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Category</Th>
                      {categoryTrendsTable.labels.map((lab) => (
                        <Th key={lab} style={{ textAlign: 'right' }}>
                          {lab}
                        </Th>
                      ))}
                      <Th style={{ textAlign: 'right' }}>Budget</Th>
                      <Th style={{ textAlign: 'right' }}>YTD total</Th>
                      <Th style={{ textAlign: 'right' }}>Avg / month</Th>
                      <Th>Trend</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {categoryTrendsTable.rows.map((r, idx) => (
                      <Tr key={r.cat}>
                        <Td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <Dot $color={CATEGORY_DOT_COLORS[idx % CATEGORY_DOT_COLORS.length]} aria-hidden />
                            {r.cat}
                          </span>
                        </Td>
                        {r.monthAmounts.map((amt, i) => (
                          <Td key={`${r.cat}-${categoryTrendsTable.monthIndices[i]}`} style={{ textAlign: 'right' }}>
                            {formatAppCurrency(amt)}
                          </Td>
                        ))}
                        <Td style={{ textAlign: 'right' }}>
                          {r.cap > 0 ? formatAppCurrency(r.cap) : '—'}
                        </Td>
                        <Td style={{ textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>
                          {formatAppCurrency(r.ytd)}
                        </Td>
                        <Td
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: r.cap > 0 && r.avg > r.cap ? '#dc2626' : '#16a34a',
                          }}
                        >
                          {formatAppCurrency(r.avg)}
                        </Td>
                        <Td>
                          <MiniTrend $trend={r.trend}>
                            {r.trend === 'up' ? <TrendingUp size={14} aria-hidden /> : null}
                            {r.trend === 'up' ? 'Rising' : r.trend === 'down' ? 'Falling' : 'Stable'}
                          </MiniTrend>
                        </Td>
                      </Tr>
                    ))}
                    <Tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                      <Td>Total</Td>
                      {categoryTrendsTable.columnTotals.map((t, i) => (
                        <Td key={`tot-${categoryTrendsTable.monthIndices[i]}`} style={{ textAlign: 'right' }}>
                          {formatAppCurrency(t)}
                        </Td>
                      ))}
                      <Td>—</Td>
                      <Td style={{ textAlign: 'right', color: '#2563eb' }}>
                        {formatAppCurrency(categoryTrendsTable.rows.reduce((s, r) => s + r.ytd, 0))}
                      </Td>
                      <Td>—</Td>
                      <Td>—</Td>
                    </Tr>
                  </Tbody>
                </Table>
              </TableWrapper>
            )
          ) : null}
        </DetailedSection>

        <ChartCard>
          <SectionHead>
            <OverviewTitle style={{ margin: 0 }}>Spending forecast &amp; trends</OverviewTitle>
            <PillTabs>
              <PillTab type="button" $active={chartTab === 'monthly'} onClick={() => setChartTab('monthly')}>
                Monthly view
              </PillTab>
              <PillTab type="button" $active={chartTab === 'yearly'} onClick={() => setChartTab('yearly')}>
                Yearly projection
              </PillTab>
            </PillTabs>
          </SectionHead>

          {chartTab === 'monthly' ? (
            <>
              <ChartFrame>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartRowsMonthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => (value == null ? '—' : formatAppCurrency(Number(value)))} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="budget"
                      name="Budget"
                      stroke="#93c5fd"
                      fill="#dbeafe"
                      fillOpacity={0.5}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      name="Actual"
                      stroke="#1d4ed8"
                      fill="#c7d2fe"
                      fillOpacity={0.35}
                      strokeWidth={2}
                      connectNulls
                    />
                    <Area
                      type="monotone"
                      dataKey="forecast"
                      name="Forecast"
                      stroke="#f97316"
                      fill="#ffedd5"
                      fillOpacity={0.3}
                      strokeWidth={2}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartFrame>
              <Callout>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                <div>
                  <strong>Forecast methodology.</strong> Projections use your average spend in months so far this
                  year; actual results may vary. Set a monthly income estimate in &quot;Set budget&quot; to improve
                  balance projections.
                </div>
              </Callout>
            </>
          ) : (
            <>
              <ChartFrame>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={yearTotals}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatAppCurrency(Number(value ?? 0))} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="spent"
                      name="Total spent"
                      stroke="#4f46e5"
                      fill="#ddd6fe"
                      fillOpacity={0.45}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="budget"
                      name="Annual budget (12× current month)"
                      stroke="#94a3b8"
                      fill="#e2e8f0"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartFrame>
              <Callout>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                <div>
                  Annual budget line uses twelve times your <strong>currently selected month&apos;s</strong> total
                  category budget as a rough yardstick—not a full year of stored budgets per month.
                </div>
              </Callout>
            </>
          )}
        </ChartCard>

        <OverviewTitle style={{ marginBottom: spacing.md }}>Budget by category</OverviewTitle>
        <CategoryList>
          {categoryRows.length === 0 ? (
            <MutedText>No categories yet. Add expenses or open Set budget.</MutedText>
          ) : (
            categoryRows.map((row) => (
              <CategoryCard key={row.name}>
                <CategoryTop>
                  <CategoryName>
                    <Dot $color={row.dot} aria-hidden />
                    {row.name}
                  </CategoryName>
                  <CategoryAmounts>
                    {formatAppCurrency(row.spent)}
                    {row.cap > 0 ? ` / ${formatAppCurrency(row.cap)}` : ' · no cap'}
                  </CategoryAmounts>
                </CategoryTop>
                <CategoryBar $pct={row.pct} $color={row.dot} $over={row.over} />
                <CategoryFooter>
                  <span>{row.cap > 0 ? `${Math.min(999, row.pct).toFixed(1)}% used` : '—'}</span>
                  <span>
                    {row.cap > 0 ? (
                      <>
                        {row.remaining >= 0 ? (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatAppCurrency(row.remaining)} left</span>
                        ) : (
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>
                            +{formatAppCurrency(Math.abs(row.remaining))} over
                          </span>
                        )}
                        {' · '}
                        <TrendTag $trend={row.trend}>{row.trendLabel}</TrendTag>
                      </>
                    ) : (
                      <TrendTag $trend={row.trend}>{row.trendLabel}</TrendTag>
                    )}
                  </span>
                </CategoryFooter>
              </CategoryCard>
            ))
          )}
        </CategoryList>

        {budgetModalOpen ? (
          <ModalBackdrop role="presentation" onMouseDown={() => setBudgetModalOpen(false)}>
            <ModalPanel
              role="dialog"
              aria-modal="true"
              aria-labelledby="budget-modal-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ModalTitle id="budget-modal-title">Budget &amp; cashflow</ModalTitle>
              <MutedText>
                Values are stored in this browser for your account. Income uses a steady monthly estimate for YTD and
                projections.
              </MutedText>
              <form onSubmit={onSaveBudgets}>
                <FormGrid>
                  <label>
                    <MutedText as="span" style={{ display: 'block', marginBottom: 4 }}>
                      Starting balance (Jan 1)
                    </MutedText>
                    <Input
                      type="number"
                      step="0.01"
                      value={draftAssumptions.startingBalance}
                      onChange={(e) =>
                        setDraftAssumptions((p: BudgetAssumptions) => ({
                          ...p,
                          startingBalance: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    <MutedText as="span" style={{ display: 'block', marginBottom: 4 }}>
                      Monthly income estimate
                    </MutedText>
                    <Input
                      type="number"
                      step="0.01"
                      value={draftAssumptions.monthlyIncomeEstimate}
                      onChange={(e) =>
                        setDraftAssumptions((p: BudgetAssumptions) => ({
                          ...p,
                          monthlyIncomeEstimate: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                </FormGrid>
                <OverviewTitle style={{ marginTop: spacing.xl, fontSize: 15 }}>
                  Category budgets · {monthKey}
                </OverviewTitle>
                <MutedText style={{ marginTop: 4 }}>Leave blank to omit a cap for that category.</MutedText>
                <FormGrid>
                  {categories.map((c) => (
                    <CategoryBudgetRow key={c}>
                      <span>{c}</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        value={draftCategoryBudgets[c] ?? ''}
                        onChange={(e) => setDraftCategoryBudgets((p) => ({ ...p, [c]: e.target.value }))}
                      />
                    </CategoryBudgetRow>
                  ))}
                </FormGrid>
                <ModalActions>
                  <Button type="button" $variant="secondary" onClick={() => setBudgetModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" $variant="accent" $weight="semibold">
                    Save
                  </Button>
                </ModalActions>
              </form>
            </ModalPanel>
          </ModalBackdrop>
        ) : null}
      </PageSurface>
    </AppLayout>
  );
};
