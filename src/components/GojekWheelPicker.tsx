import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface DateOption {
  id: string;
  label: string; // e.g. "Hari ini", "Besok", "17 Sel", "18 Rab"
  dateObj: Date;
}

interface GojekWheelPickerProps {
  mode: 'TODAY' | 'TOMORROW' | 'DATE';
  timeSlots: string[]; // e.g. ["20:25 - 20:30", "20:30 - 20:35", ...]
  selectedTimeSlot: string;
  onSelectTimeSlot: (slot: string) => void;
  dateList?: DateOption[];
  selectedDateId?: string;
  onSelectDate?: (dateOpt: DateOption) => void;
}

const ITEM_HEIGHT = 48;

export const GojekWheelPicker: React.FC<GojekWheelPickerProps> = ({
  mode,
  timeSlots,
  selectedTimeSlot,
  onSelectTimeSlot,
  dateList = [],
  selectedDateId,
  onSelectDate,
}) => {
  const timeColumnRef = useRef<HTMLDivElement | null>(null);
  const dateColumnRef = useRef<HTMLDivElement | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<any>(null);

  // Scroll time column to the selected slot index on mount or mode change
  useEffect(() => {
    if (!timeColumnRef.current || isScrolling) return;
    const idx = timeSlots.findIndex((s) => s === selectedTimeSlot);
    if (idx >= 0) {
      const currentIdx = Math.round(timeColumnRef.current.scrollTop / ITEM_HEIGHT);
      if (currentIdx !== idx) {
        timeColumnRef.current.scrollTop = idx * ITEM_HEIGHT;
      }
    }
  }, [mode, selectedTimeSlot, timeSlots, isScrolling]);

  // Scroll date column to selected date on mount or change
  useEffect(() => {
    if (mode !== 'DATE' || !dateColumnRef.current || !selectedDateId || isScrolling) return;
    const idx = dateList.findIndex((d) => d.id === selectedDateId);
    if (idx >= 0) {
      const currentIdx = Math.round(dateColumnRef.current.scrollTop / ITEM_HEIGHT);
      if (currentIdx !== idx) {
        dateColumnRef.current.scrollTop = idx * ITEM_HEIGHT;
      }
    }
  }, [mode, selectedDateId, dateList, isScrolling]);

  // Handle time scroll snap listener
  const handleTimeScroll = useCallback(() => {
    if (!timeColumnRef.current) return;
    setIsScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
      if (!timeColumnRef.current) return;
      const scrollTop = timeColumnRef.current.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(timeSlots.length - 1, index));
      const targetSlot = timeSlots[clamped];
      if (targetSlot && targetSlot !== selectedTimeSlot) {
        onSelectTimeSlot(targetSlot);
      }
    }, 80);
  }, [timeSlots, selectedTimeSlot, onSelectTimeSlot]);

  // Handle date scroll snap listener
  const handleDateScroll = useCallback(() => {
    if (!dateColumnRef.current || mode !== 'DATE') return;
    setIsScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
      if (!dateColumnRef.current) return;
      const scrollTop = dateColumnRef.current.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(dateList.length - 1, index));
      const targetDate = dateList[clamped];
      if (targetDate && targetDate.id !== selectedDateId && onSelectDate) {
        onSelectDate(targetDate);
      }
    }, 80);
  }, [mode, dateList, selectedDateId, onSelectDate]);

  return (
    <div
      className={`gf-gojek-wheel-container ${isScrolling ? 'is-scrolling' : ''}`}
      role="region"
      aria-label="Pemilih waktu penjemputan drum wheel"
    >
      {/* Selection Lens: Top & Bottom Horizontal Framing Lines */}
      <div className="gf-gojek-wheel-selection-lens">
        {mode === 'DATE' && <div className="gf-gojek-wheel-divider" />}
      </div>

      {/* Date Wheel Column (Only active on "Pilih tanggal") */}
      {mode === 'DATE' && (
        <div
          ref={dateColumnRef}
          className="gf-gojek-wheel-column"
          onScroll={handleDateScroll}
          aria-label="Pilih tanggal"
        >
          {dateList.map((d, idx) => {
            const isSel = d.id === selectedDateId;
            return (
              <div
                key={d.id}
                className={`gf-gojek-wheel-item ${isSel ? 'is-selected' : ''}`}
                onClick={() => {
                  if (dateColumnRef.current) {
                    dateColumnRef.current.scrollTo({
                      top: idx * ITEM_HEIGHT,
                      behavior: 'smooth',
                    });
                  }
                  if (onSelectDate) onSelectDate(d);
                }}
              >
                <span>{d.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Time Wheel Column (5-Minute Slot Windows) */}
      <div
        ref={timeColumnRef}
        className="gf-gojek-wheel-column"
        onScroll={handleTimeScroll}
        aria-label="Pilih slot waktu penjemputan"
      >
        {timeSlots.map((slot, idx) => {
          const isSel = slot === selectedTimeSlot;
          return (
            <div
              key={slot}
              className={`gf-gojek-wheel-item ${isSel ? 'is-selected' : ''}`}
              onClick={() => {
                if (timeColumnRef.current) {
                  timeColumnRef.current.scrollTo({
                    top: idx * ITEM_HEIGHT,
                    behavior: 'smooth',
                  });
                }
                onSelectTimeSlot(slot);
              }}
            >
              <span>{slot}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
