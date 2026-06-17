export default function DashboardHome() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-white mb-2">Dashboard</h1>
      <p className="text-gray-400 text-sm mb-8">Welcome to iCar Dealership — Admin Portal</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Deals', value: '—', color: 'text-blue-400' },
          { label: 'Vehicles Available', value: '—', color: 'text-green-400' },
          { label: 'Open Leads', value: '—', color: 'text-yellow-400' },
          { label: 'Revenue (MTD)', value: '—', color: 'text-purple-400' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/5 bg-gray-900 p-5"
          >
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-2xl font-semibold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-white/5 bg-gray-900 p-6">
        <p className="text-sm text-gray-400">
          Module implementations will populate these panels. Connect the API at{' '}
          <code className="text-blue-400">{process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}</code>.
        </p>
      </div>
    </div>
  );
}
