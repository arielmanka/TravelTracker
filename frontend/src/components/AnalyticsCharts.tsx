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
    trends: { month: string; days: number }[];
  };
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ analytics }) => {
  const { countryStays, trends } = analytics;

  const hasStaysData = countryStays && countryStays.length > 0;
  const hasTrendsData = trends && trends.length > 0;

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
    datasets: [
      {
        fill: true,
        label: 'Days Spent',
        data: trends.map(item => item.days),
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: '#10b981',
        borderWidth: 2.5,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#090d16',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.35
      }
    ]
  };

  const trendChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
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
    }
  };

  return (
    <div className="grid-2">
      {/* Country stays chart */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Days Spent per Country</h3>
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
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Monthly Stay Timeline Trends</h3>
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
