import { describe, expect, it } from 'vitest';
import { changeStatus, Laptop, LaptopStatus, TransitionError } from './laptop';

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
    expect(() => changeStatus(makeLaptop(from), to)).toThrow(TransitionError);
    expect(() => changeStatus(makeLaptop(from), to)).toThrow(/Нельзя сменить статус/);
  });

  it('при ошибке статус и история не меняются', () => {
    const laptop = makeLaptop('written_off');
    expect(() => changeStatus(laptop, 'in_stock')).toThrow(TransitionError);
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
});
