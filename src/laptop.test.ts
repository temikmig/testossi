import { describe, expect, it } from 'vitest';
import {
  changeStatus,
  getTransitionError,
  isTransitionError,
  Laptop,
  LaptopStatus,
} from './laptop';

function makeLaptop(status: LaptopStatus = 'in_stock', history: Laptop['history'] = []): Laptop {
  return { id: 'lp-1', status, history };
}

function makeSoldLaptop(soldAt: Date): Laptop {
  return makeLaptop('sold', [{ from: 'in_stock', to: 'sold', date: soldAt }]);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const soldAt = new Date('2026-10-01T12:00:00Z');
const daysAfterSale = (n: number) => new Date(soldAt.getTime() + n * DAY_MS);

describe('допустимые переходы', () => {
  it.each<[LaptopStatus, LaptopStatus]>([
    ['in_stock', 'reserved'],
    ['in_stock', 'sold'],
    ['in_stock', 'written_off'],
    ['reserved', 'in_stock'],
    ['reserved', 'sold'],
  ])('%s -> %s', (from, to) => {
    const laptop = changeStatus(makeLaptop(from), to);
    expect(laptop.status).toBe(to);
  });
});

describe('недопустимые переходы', () => {
  it.each<[LaptopStatus, LaptopStatus]>([
    ['reserved', 'written_off'],
    ['sold', 'reserved'],
    ['sold', 'written_off'],
    ['written_off', 'in_stock'],
    ['written_off', 'reserved'],
    ['written_off', 'sold'],
  ])('%s -> %s кидает ошибку', (from, to) => {
    expect(() => changeStatus(makeLaptop(from), to)).toThrow(/Нельзя сменить статус/);
  });

  it('в ошибке есть from и to', () => {
    try {
      changeStatus(makeLaptop('written_off'), 'sold');
      expect.fail('ошибка не брошена');
    } catch (error) {
      expect(isTransitionError(error)).toBe(true);
      if (isTransitionError(error)) {
        expect(error.from).toBe('written_off');
        expect(error.to).toBe('sold');
      }
    }
  });

  it('при ошибке статус и история не меняются', () => {
    const laptop = makeLaptop('written_off');
    expect(() => changeStatus(laptop, 'in_stock')).toThrow(/Нельзя сменить статус/);
    expect(laptop.status).toBe('written_off');
    expect(laptop.history).toHaveLength(0);
  });
});

describe('история', () => {
  it('пишет что было, что стало и дату', () => {
    const date1 = new Date('2026-10-05T10:00:00Z');
    const date2 = new Date('2026-10-06T10:00:00Z');
    const laptop = makeLaptop('in_stock');

    changeStatus(laptop, 'reserved', date1);
    changeStatus(laptop, 'sold', date2);

    expect(laptop.history).toEqual([
      { from: 'in_stock', to: 'reserved', date: date1 },
      { from: 'reserved', to: 'sold', date: date2 },
    ]);
  });
});

describe('возврат проданного', () => {
  it('можно в пределах 14 дней', () => {
    const laptop = changeStatus(makeSoldLaptop(soldAt), 'in_stock', daysAfterSale(10));
    expect(laptop.status).toBe('in_stock');
  });

  it('нельзя позже 14 дней', () => {
    expect(() => changeStatus(makeSoldLaptop(soldAt), 'in_stock', daysAfterSale(15))).toThrow(
      /Возврат невозможен/,
    );
  });

  it('ровно 14 дней еще можно', () => {
    const laptop = changeStatus(makeSoldLaptop(soldAt), 'in_stock', daysAfterSale(14));
    expect(laptop.status).toBe('in_stock');
  });

  it('14 дней и 1 мс уже нельзя', () => {
    const justAfter = new Date(daysAfterSale(14).getTime() + 1);
    expect(() => changeStatus(makeSoldLaptop(soldAt), 'in_stock', justAfter)).toThrow(
      /Возврат невозможен/,
    );
  });

  it('нельзя, если в истории нет даты продажи', () => {
    const laptop = makeLaptop('sold');
    expect(() => changeStatus(laptop, 'in_stock')).toThrow(/нет даты продажи/);
  });
});

describe('getTransitionError', () => {
  it('для разрешенного перехода возвращает null', () => {
    expect(getTransitionError(makeLaptop('in_stock'), 'reserved')).toBeNull();
  });

  it('для запрещенного возвращает ошибку с причиной', () => {
    const error = getTransitionError(makeLaptop('written_off'), 'sold');
    expect(error?.message).toMatch(/Нельзя сменить статус/);
    expect(error?.from).toBe('written_off');
  });

  it('учитывает окно возврата', () => {
    const laptop = makeSoldLaptop(soldAt);
    expect(getTransitionError(laptop, 'in_stock', daysAfterSale(14))).toBeNull();
    expect(getTransitionError(laptop, 'in_stock', daysAfterSale(15))?.message).toMatch(
      /Возврат невозможен/,
    );
  });

  it('ничего не меняет', () => {
    const laptop = makeLaptop('in_stock');
    getTransitionError(laptop, 'reserved');
    expect(laptop.status).toBe('in_stock');
    expect(laptop.history).toHaveLength(0);
  });
});
