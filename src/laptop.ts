/** Статус ноутбука на складе. */
export type LaptopStatus = 'in_stock' | 'reserved' | 'sold' | 'written_off';

/** Названия статусов для вывода. */
export const STATUS_LABELS: Record<LaptopStatus, string> = {
  in_stock: 'На складе',
  reserved: 'Бронь',
  sold: 'Продан',
  written_off: 'Списан',
};

/** Запись в истории смены статусов. */
export interface StatusChange {
  from: LaptopStatus;
  to: LaptopStatus;
  date: Date;
}

export interface Laptop {
  id: string;
  status: LaptopStatus;
  history: StatusChange[];
}

/** Из какого статуса в какие можно перейти. */
const ALLOWED_TRANSITIONS: Record<LaptopStatus, readonly LaptopStatus[]> = {
  in_stock: ['reserved', 'sold', 'written_off'],
  reserved: ['in_stock', 'sold'],
  sold: ['in_stock'],
  written_off: [],
};

/** Сколько дней есть на возврат после продажи. */
const RETURN_WINDOW_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Ошибка перехода: обычный Error, но с from/to. */
export type TransitionError = Error & {
  name: 'TransitionError';
  from: LaptopStatus;
  to: LaptopStatus;
};

function transitionError(from: LaptopStatus, to: LaptopStatus, message?: string): TransitionError {
  const error = new Error(
    message ?? `Нельзя сменить статус с "${STATUS_LABELS[from]}" на "${STATUS_LABELS[to]}"`,
  ) as TransitionError;
  error.name = 'TransitionError';
  error.from = from;
  error.to = to;
  return error;
}

export function isTransitionError(error: unknown): error is TransitionError {
  return error instanceof Error && error.name === 'TransitionError';
}

/**
 * Меняет статус ноутбука и пишет изменение в историю.
 * Кидает ошибку, если переход запрещен.
 */
export function changeStatus(laptop: Laptop, to: LaptopStatus, date: Date = new Date()): Laptop {
  const from = laptop.status;

  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw transitionError(from, to);
  }

  // возврат проданного не позднее 14 дней после продажи
  if (from === 'sold' && to === 'in_stock') {
    const saleDate = [...laptop.history].reverse().find((e) => e.to === 'sold')!.date;
    if (date.getTime() - saleDate.getTime() >= RETURN_WINDOW_DAYS * MS_PER_DAY) {
      throw transitionError(
        from,
        to,
        `Возврат невозможен: прошло больше ${RETURN_WINDOW_DAYS} дней с продажи`,
      );
    }
  }

  laptop.status = to;
  laptop.history.push({ from, to, date });
  return laptop;
}
