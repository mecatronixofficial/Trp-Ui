import {
  FiBox,
  FiCheckCircle,
  FiDollarSign,
  FiGitBranch,
  FiShoppingCart,
  FiTrendingUp,
} from 'react-icons/fi';

const sales = [
  { customer: 'Sri Murugan Stores', bars: 4, amount: 1200, collected: 1200 },
  { customer: 'Kumar', bars: 6, amount: 1800, collected: 1000 },
  { customer: 'Siva Traders', bars: 3, amount: 900, collected: 0 },
  { customer: 'Annai Ice Depot', bars: 8, amount: 2400, collected: 2400 },
];

const expenses = [
  { name: 'Worker Amount', amount: 1200 },
  { name: 'Diesel', amount: 850 },
  { name: 'Electricity', amount: 750 },
  { name: 'Food', amount: 400 },
];

const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
}).format(value);

export default function AdminSamplePage() {
  const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const collectionAmount = sales.reduce((sum, sale) => sum + sale.collected, 0);
  const totalBars = sales.reduce((sum, sale) => sum + sale.bars, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const finalTotal = collectionAmount - totalExpenses;

  return (
    <div className="space-y-5 pb-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#071824] via-sky-950 to-iceblue-700 text-white shadow-xl shadow-navy-900/15">
        <div className="flex flex-col gap-5 px-5 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-iceblue-200">
              <FiGitBranch /> Admin sample report
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Today&apos;s Business Summary</h1>
            <p className="mt-2 text-sm text-white/70">Sample sales, expenses, production and final collection balance.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold">Tiruppur Ice (638702)</span>
            <span className="rounded-xl bg-emerald-400/15 px-4 py-2 text-xs font-bold text-emerald-100 ring-1 ring-emerald-300/25">Today</span>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:row-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-sky-100 bg-sky-50/60 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-100 text-sky-700"><FiShoppingCart /></span>
              <div>
                <h2 className="font-display text-lg font-bold text-navy-900">Today&apos;s Sales Report</h2>
                <p className="mt-0.5 text-xs text-navy-800/45">Customer-wise sales recorded today</p>
              </div>
            </div>
            <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-sky-700 ring-1 ring-sky-100">{sales.length} sales</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead className="bg-slate-100 text-[11px] font-bold uppercase tracking-wide text-navy-900">
                <tr>
                  <th className="w-14 border border-slate-300 px-3 py-3 text-center">#</th>
                  <th className="border border-slate-300 px-3 py-3 text-left">Customer Name</th>
                  <th className="border border-slate-300 px-3 py-3 text-right">Bars</th>
                  <th className="border border-slate-300 px-3 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale, index) => (
                  <tr key={sale.customer} className="even:bg-slate-50/70 hover:bg-sky-50/60">
                    <td className="border border-slate-200 px-3 py-3 text-center text-slate-400">{index + 1}</td>
                    <td className="border border-slate-200 px-3 py-3 font-semibold text-navy-900">{sale.customer}</td>
                    <td className="border border-slate-200 px-3 py-3 text-right font-bold">{sale.bars}</td>
                    <td className="border border-slate-200 px-3 py-3 text-right font-bold text-emerald-700">{formatCurrency(sale.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-navy-900 font-bold text-white">
                  <td colSpan={2} className="border border-navy-800 px-3 py-3 text-right text-xs uppercase tracking-wide">Today Total</td>
                  <td className="border border-navy-800 px-3 py-3 text-right">{totalBars}</td>
                  <td className="border border-navy-800 px-3 py-3 text-right">{formatCurrency(totalSales)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-red-100 bg-red-50/60 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-600"><FiDollarSign /></span>
              <div>
                <h2 className="font-display text-lg font-bold text-navy-900">Today&apos;s Expense Report</h2>
                <p className="mt-0.5 text-xs text-navy-800/45">Expense name and amount</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-100 px-4">
            {expenses.map((expense) => (
              <div key={expense.name} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="font-semibold text-navy-900">{expense.name}</span>
                <span className="font-bold text-red-600">{formatCurrency(expense.amount)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between bg-red-50 px-4 py-3 text-sm font-bold">
            <span className="text-red-700">Total Expenses</span>
            <span className="text-red-700">{formatCurrency(totalExpenses)}</span>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-cyan-100 bg-cyan-50/60 px-4 py-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-100 text-cyan-700"><FiBox /></span>
            <div>
              <h2 className="font-display text-lg font-bold text-navy-900">Today&apos;s Production</h2>
              <p className="mt-0.5 text-xs text-navy-800/45">Current box-counter report</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">Open Box</p>
              <p className="mt-2 font-display text-3xl font-bold text-navy-900">51</p>
            </div>
            <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-700/70">Close Box</p>
              <p className="mt-2 font-display text-3xl font-bold text-cyan-700">63</p>
            </div>
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-lg shadow-emerald-900/5">
        <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
          <div className="bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-navy-800/45">Today Total Sales</p>
            <p className="mt-2 font-display text-2xl font-bold text-navy-900">{formatCurrency(totalSales)}</p>
          </div>
          <div className="bg-emerald-50/50 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/70">Collection Amount</p>
            <p className="mt-2 font-display text-2xl font-bold text-emerald-700">{formatCurrency(collectionAmount)}</p>
          </div>
          <div className="bg-red-50/50 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-red-600/70">Total Expenses</p>
            <p className="mt-2 font-display text-2xl font-bold text-red-600">− {formatCurrency(totalExpenses)}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-xl"><FiTrendingUp /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">Final Total</p>
              <p className="mt-1 text-sm text-white/75">Collection Amount − Total Expenses</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-display text-3xl font-bold">{formatCurrency(finalTotal)}</p>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-100 sm:justify-end"><FiCheckCircle /> Today&apos;s net collection</p>
          </div>
        </div>
      </section>
    </div>
  );
}
