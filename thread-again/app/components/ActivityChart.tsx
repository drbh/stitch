import React, { useMemo } from "react";
import {
  addDays,
  format,
  parseISO,
  subWeeks,
  startOfWeek,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";

// Types
interface Post {
  id: number;
  time: string;
  [key: string]: any;
}

interface ActivityChartProps {
  posts: Post[];
  weeksToShow?: number;
  colorTheme?: "blue" | "green" | "purple";
}

// Day cell component
const DayCell = ({ count, maxCount, date, colorTheme = "blue" }) => {
  // Calculate intensity based on count and max
  let intensity = 0;
  if (count > 0) {
    intensity = Math.ceil((count / maxCount) * 4);
    intensity = Math.min(intensity, 4); // Limit to 4 levels of intensity
  }

  // Define color themes for the cells
  const colorThemes = {
    blue: [
      "bg-surface-secondary", // Empty
      "bg-blue-900",
      "bg-blue-800",
      "bg-blue-700",
      "bg-blue-600",
    ],
    green: [
      "bg-surface-secondary", // Empty
      "bg-green-900",
      "bg-green-800",
      "bg-green-700",
      "bg-green-600",
    ],
    purple: [
      "bg-surface-secondary", // Empty
      "bg-purple-900",
      "bg-purple-800",
      "bg-purple-700",
      "bg-purple-600",
    ],
  };

  const colors = colorThemes[colorTheme] || colorThemes.blue;
  const backgroundColor = colors[intensity];

  // Format date for tooltip
  const formattedDate = format(date, "MMM d, yyyy");
  const activityText =
    count === 0 ? "No posts" : `${count} post${count === 1 ? "" : "s"}`;

  return (
    <div className="relative group" title={`${formattedDate}: ${activityText}`}>
      <div
        // className={`w-5 h-5 rounded-sm ${backgroundColor} border border-border`}
        className={`w-5 h-5 rounded-sm ${backgroundColor} border border-border`}
      />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-surface-tertiary text-xs text-gray-300 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity whitespace-nowrap z-10 border border-border">
        {formattedDate}: {activityText}
      </div>
    </div>
  );
};

// Color legend component
const ActivityLegend = ({ maxCount, colorTheme = "blue" }) => {
  // Define color themes for the legend
  const colorThemes = {
    blue: [
      "bg-surface-secondary", // Empty
      "bg-blue-900",
      "bg-blue-800",
      "bg-blue-700",
      "bg-blue-600",
    ],
    green: [
      "bg-surface-secondary", // Empty
      "bg-green-900",
      "bg-green-800",
      "bg-green-700",
      "bg-green-600",
    ],
    purple: [
      "bg-surface-secondary", // Empty
      "bg-purple-900",
      "bg-purple-800",
      "bg-purple-700",
      "bg-purple-600",
    ],
  };

  const colors = colorThemes[colorTheme] || colorThemes.blue;

  // Create ranges for legend
  const ranges = [
    "No posts",
    "1-2 posts",
    "3-5 posts",
    "6-9 posts",
    "10+ posts",
  ];

  return (
    <div className="flex items-center justify-end text-xs text-gray-400 mt-2">
      <span className="mr-2">Less</span>
      {colors.map((color, index) => (
        <div key={index} className="relative group" title={ranges[index]}>
          <div
            className={`w-4 h-4 rounded-sm mx-0.5 ${color} border border-border`}
          />
          <div className="absolute bottom-full right-0 mb-1 px-2 py-1 bg-surface-tertiary text-xs text-gray-300 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity whitespace-nowrap z-10 border border-border">
            {ranges[index]}
          </div>
        </div>
      ))}
      <span className="ml-2">More</span>
    </div>
  );
};

// Month labels component
const MonthLabels = ({ days }) => {
  // Get unique months from days
  const months = useMemo(() => {
    const uniqueMonths = [];
    let currentMonth = "";

    days.forEach((day, index) => {
      const month = format(day, "MMM");
      if (month !== currentMonth) {
        uniqueMonths.push({ month, index });
        currentMonth = month;
      }
    });

    return uniqueMonths;
  }, [days]);

  return (
    <div className="flex text-xs text-gray-500 ml-7">
      {months.map(({ month, index }, i) => (
        <div
          key={month + index}
          className="absolute"
          style={{ left: `${(index / days.length) * 100}%` }}
        >
          {month}
        </div>
      ))}
    </div>
  );
};

// Week day labels component
const WeekdayLabels = () => {
  // Show only Monday, Wednesday, Friday for space reasons
  const weekdays = [
    { day: "Mon", index: 1 },
    { day: "Wed", index: 3 },
    { day: "Fri", index: 5 },
  ];

  return (
    <div className="flex flex-col h-full justify-between mr-2 text-xs text-gray-500">
      {weekdays.map(({ day, index }) => (
        <div
          key={day}
          style={{ height: "12px", marginTop: index === 1 ? "3px" : "15px" }}
        >
          {day}
        </div>
      ))}
    </div>
  );
};

// Main activity chart component
const ActivityChart = ({
  posts,
  weeksToShow = 26,
  colorTheme = "blue",
}: ActivityChartProps) => {
  // Generate the date grid and count activity
  const { days, counts, maxCount, firstDay } = useMemo(() => {
    const today = new Date();
    const startDate = startOfWeek(subWeeks(today, weeksToShow - 1));

    // Generate all days in the interval
    const days = eachDayOfInterval({
      start: startDate,
      end: today,
    });

    // Initialize counts for each day
    const counts = Array(days.length).fill(0);
    let maxCount = 0;

    // Count posts for each day
    posts.forEach((post) => {
      try {
        const postDate = parseISO(post.time);

        // Find the index of the day in our array
        const dayIndex = days.findIndex((day) => isSameDay(day, postDate));

        if (dayIndex !== -1) {
          counts[dayIndex]++;
          maxCount = Math.max(maxCount, counts[dayIndex]);
        }
      } catch (e) {
        // Skip invalid dates
        console.warn("Invalid date format:", post.time);
      }
    });

    return { days, counts, maxCount, firstDay: startDate };
  }, [posts, weeksToShow]);

  // Calculate stats
  const totalPosts = counts.reduce((sum, count) => sum + count, 0);
  const activeDays = counts.filter((count) => count > 0).length;
  const averagePerDay = activeDays ? (totalPosts / activeDays).toFixed(1) : "0";

  // Find current streak
  const getCurrentStreak = () => {
    let streak = 0;
    let i = counts.length - 1;

    // Start from the most recent day
    while (i >= 0 && counts[i] > 0) {
      streak++;
      i--;
    }

    return streak;
  };

  // Find longest streak
  const getLongestStreak = () => {
    let currentStreak = 0;
    let longestStreak = 0;

    for (let i = 0; i < counts.length; i++) {
      if (counts[i] > 0) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return longestStreak;
  };

  const currentStreak = getCurrentStreak();
  const longestStreak = getLongestStreak();

  return (
    <div className="bg-surface-primary rounded-md border border-border p-4 mb-6">
      <h3 className="text-lg text-white mb-4">Activity Overview</h3>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-secondary rounded-md p-3 border border-border">
          <div className="text-gray-400 text-xs mb-1">Total Posts</div>
          <div className="text-white text-xl font-medium">{totalPosts}</div>
        </div>
        <div className="bg-surface-secondary rounded-md p-3 border border-border">
          <div className="text-gray-400 text-xs mb-1">Active Days</div>
          <div className="text-white text-xl font-medium">
            {activeDays} days
          </div>
        </div>
        <div className="bg-surface-secondary rounded-md p-3 border border-border">
          <div className="text-gray-400 text-xs mb-1">Current Streak</div>
          <div className="text-white text-xl font-medium">
            {currentStreak} days
          </div>
        </div>
        <div className="bg-surface-secondary rounded-md p-3 border border-border">
          <div className="text-gray-400 text-xs mb-1">Longest Streak</div>
          <div className="text-white text-xl font-medium">
            {longestStreak} days
          </div>
        </div>
      </div>

      {/* Chart title */}
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm text-white font-medium">
          {totalPosts} posts in the last {weeksToShow} weeks
        </h4>
        <div className="text-xs text-gray-400">
          Avg: {averagePerDay} posts per active day
        </div>
      </div>

      {/* GitHub-style activity grid */}
      <div className="flex items-start mb-2 relative">
        {/* Day of week labels */}
        <WeekdayLabels />

        {/* Activity cells */}
        <div className="flex-1 grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto">
          {days.map((day, index) => (
            <DayCell
              key={day.toISOString()}
              date={day}
              count={counts[index]}
              maxCount={maxCount || 1}
              colorTheme={colorTheme}
            />
          ))}
        </div>
      </div>

      {/* Month labels */}
      <div className="relative h-5 ml-6">
        <MonthLabels days={days} />
      </div>

      {/* Legend */}
      <ActivityLegend maxCount={maxCount || 1} colorTheme={colorTheme} />
    </div>
  );
};

export default ActivityChart;
