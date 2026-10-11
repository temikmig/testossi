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

/** Ноутбук: текущий статус и вся история его смен. */
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

/** Проверка, что это ошибка перехода, а не что-то другое. */
export function isTransitionError(error: unknown): error is TransitionError {
  return error instanceof Error && error.name === 'TransitionError';
}

/**
 * Проверяет переход, ничего не меняя. Вернет ошибку или null.
 * Нужна странице, чтобы гасить кнопки до клика и не копировать правила переходов.
 */
export function getTransitionError(
  laptop: Laptop,
  to: LaptopStatus,
  date: Date = new Date(),
): TransitionError | null {
  const from = laptop.status;

  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    return transitionError(from, to);
  }

  // возврат проданного не позднее 14 дней после продажи
  if (from === 'sold' && to === 'in_stock') {
    const saleEntry = [...laptop.history].reverse().find((e) => e.to === 'sold');
    // статус продан, а продажи в истории нет: считать окно не от чего
    if (!saleEntry) {
      return transitionError(from, to, 'Возврат невозможен: в истории нет даты продажи');
    }
    const elapsed = date.getTime() - saleEntry.date.getTime();
    if (elapsed < 0) {
      return transitionError(from, to, 'Возврат невозможен: дата возврата раньше продажи');
    }
    // не позднее 14 дней = 14-й день еще считается
    if (elapsed > RETURN_WINDOW_DAYS * MS_PER_DAY) {
      return transitionError(
        from,
        to,
        `Возврат невозможен: прошло больше ${RETURN_WINDOW_DAYS} дней с продажи`,
      );
    }
  }

  return null;
}

/**
 * Меняет статус ноутбука и пишет изменение в историю.
 * Кидает ошибку, если переход запрещен.
 */
export function changeStatus(laptop: Laptop, to: LaptopStatus, date: Date = new Date()): Laptop {
  const error = getTransitionError(laptop, to, date);
  if (error) {
    throw error;
  }

  // копия даты, иначе вызывающий код сможет переписать историю задним числом
  laptop.history.push({ from: laptop.status, to, date: new Date(date.getTime()) });
  laptop.status = to;
  return laptop;
}
