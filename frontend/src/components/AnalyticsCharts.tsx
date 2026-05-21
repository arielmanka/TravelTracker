import React from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AnalyticsChartsProps {
  analytics: {
    countryStays: { country: string; days: number }[];
    trends: any[];
  };
}

const COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
];

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ analytics }) => {
  const { countryStays, trends } = analytics;

  const hasStaysData = countryStays && countryStays.length > 0;
  const hasTrendsData = trends && trends.length > 0;

  // Extract unique countries from the trends data for multiple lines
  const trendCountries = Array.from(new Set(
    trends.flatMap(t => Object.keys(t).filter(k => k !== 'month'))
  ));

  // Chart 1: Stays by Country (Bar)
  const countryChartData = {
    labels: countryStays.map(item => item.country),
    datasets: [
      {
        label: 'Days Spent',
        data: countryStays.map(item => item.days),
        backgroundColor: 'rgba(59, 130, 246, 0.55)',
        borderColor: '#3b82f6',
        borderWidth: 1.5,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(139, 92, 246, 0.7)',
        hoverBorderColor: '#8b5cf6',
      }
    ]
  };

  const countryChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => ` Stay duration: ${context.parsed.y} day(s)`
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)'
        },
        ticks: {
          color: '#94a3b8',
          font: {
            family: 'Inter'
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)'
        },
        ticks: {
          color: '#94a3b8',
          font: {
            family: 'Inter'
          },
          stepSize: 1
        }
      }
    }
  };

  // Chart 2: Stays Trends by Month (Line)
  const trendChartData = {
    labels: trends.map(item => {
      // Convert YYYY-MM to Month Name YYYY for readability
      const [year, month] = item.month.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString([], { month: 'short', year: 'numeric' });
    }),
    datasets: trendCountries.map((country, i) => {
      const color = COLORS[i % COLORS.length];
      return {
        fill: false,
        label: country,
        data: trends.map(item => item[country] || 0),
        backgroundColor: color + '33',
        borderColor: color,
        borderWidth: 2.5,
        pointBackgroundColor: color,
        pointBorderColor: '#090d16',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35
      };
    })
  };

  const trendChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#e2e8f0',
          font: {
            family: 'Inter'
          },
          usePointStyle: true,
          boxWidth: 8
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} cumulative days`
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#94a3b8',
          font: {
            family: 'Inter'
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)'
        },
        ticks: {
          color: '#94a3b8',
          font: {
            family: 'Inter'
          },
          stepSize: 1
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Country stays chart */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Days Spent per Country (Last 365 Days)</h3>
        <div style={{ height: '300px', position: 'relative' }}>
          {hasStaysData ? (
            <Bar data={countryChartData} options={countryChartOptions} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No stays data logged yet. Stays will appear here once logged.
            </div>
          )}
        </div>
      </div>

      {/* Monthly trends chart */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Cumulative Days per Country — Last 365 Days</h3>
        <div style={{ height: '300px', position: 'relative' }}>
          {hasTrendsData ? (
            <Line data={trendChartData} options={trendChartOptions} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No monthly stay patterns detected yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
