"use client";

import { useState } from "react";

import { MONTHS_RU, WEEKDAYS_RU, monthGrid, toIsoDate } from "@/lib/dates";

type CalendarProps = {
  // Выбранные даты (YYYY-MM-DD). Для одиночного выбора — массив из одной.
  selected: readonly string[];
  onToggle: (date: string) => void;
  // Дата недоступна для выбора (серая, не нажимается).
  isDisabled?: (date: string) => boolean;
  // Дата закрыта администратором: показать отдельным стилем.
  isBlocked?: (date: string) => boolean;
  // Сколько месяцев вперёд можно листать.
  monthsAhead?: number;
  initialMonth?: Date;
};

export function Calendar({
  selected,
  onToggle,
  isDisabled,
  isBlocked,
  monthsAhead = 12,
  initialMonth
}: CalendarProps) {
  const today = new Date();
  const [view, setView] = useState(() => {
    const base = initialMonth ?? today;
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  const monthIndex = (y: number, m: number) => y * 12 + m;
  const minIndex = monthIndex(today.getFullYear(), today.getMonth());
  const maxIndex = minIndex + monthsAhead;
  const current = monthIndex(view.year, view.month);

  const shift = (delta: number) => {
    const next = current + delta;
    if (next < minIndex || next > maxIndex) {
      return;
    }
    setView({ year: Math.floor(next / 12), month: next % 12 });
  };

  const cells = monthGrid(view.year, view.month);
  const todayIso = toIsoDate(today);

  return (
    <div className="calendar" role="group" aria-label="Календарь">
      <div className="calendar__header">
        <button
          type="button"
          className="calendar__nav"
          onClick={() => shift(-1)}
          disabled={current <= minIndex}
          aria-label="Предыдущий месяц"
        >
          ‹
        </button>
        <span className="calendar__title">
          {MONTHS_RU[view.month]} {view.year}
        </span>
        <button
          type="button"
          className="calendar__nav"
          onClick={() => shift(1)}
          disabled={current >= maxIndex}
          aria-label="Следующий месяц"
        >
          ›
        </button>
      </div>
      <div className="calendar__weekdays">
        {WEEKDAYS_RU.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar__grid">
        {cells.map((date, index) => {
          if (!date) {
            return <span key={`empty-${index}`} className="calendar__cell calendar__cell--empty" />;
          }
          const iso = toIsoDate(date);
          const disabled = isDisabled?.(iso) ?? false;
          const blocked = isBlocked?.(iso) ?? false;
          const isSelected = selected.includes(iso);
          const className = [
            "calendar__cell",
            "calendar__day",
            isSelected && "calendar__day--selected",
            blocked && "calendar__day--blocked",
            disabled && "calendar__day--disabled",
            iso === todayIso && "calendar__day--today"
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={iso}
              type="button"
              className={className}
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
              onClick={() => onToggle(iso)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
