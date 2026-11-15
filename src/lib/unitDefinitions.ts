export interface UnitDef {
  id: string;
  symbol: string;
  name: string;
  aliases: string[];
  // Conversion to base unit: base = val * factor + offset (for affine units like temp)
  toBase: (val: number) => number;
  fromBase: (base: number) => number;
}

export interface UnitCategory {
  id: string;
  label: string;
  baseUnitId: string;
  units: UnitDef[];
}

function linear(id: string, symbol: string, name: string, factor: number, aliases: string[] = []): UnitDef {
  return {
    id,
    symbol,
    name,
    aliases: [id.toLowerCase(), symbol.toLowerCase(), name.toLowerCase(), ...aliases.map((a) => a.toLowerCase())],
    toBase: (v) => v * factor,
    fromBase: (b) => b / factor,
  };
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: 'length',
    label: 'Length',
    baseUnitId: 'm',
    units: [
      linear('m', 'm', 'Meter', 1, ['meter', 'meters', 'metre', 'metres']),
      linear('km', 'km', 'Kilometer', 1000, ['kilometer', 'kilometers', 'klick']),
      linear('cm', 'cm', 'Centimeter', 0.01, ['centimeter', 'centimeters']),
      linear('mm', 'mm', 'Millimeter', 0.001, ['millimeter', 'millimeters']),
      linear('um', 'μm', 'Micrometer', 1e-6, ['micrometer', 'micron', 'microns']),
      linear('nm', 'nm', 'Nanometer', 1e-9, ['nanometer', 'nanometers']),
      linear('mi', 'mi', 'Mile', 1609.344, ['mile', 'miles']),
      linear('yd', 'yd', 'Yard', 0.9144, ['yard', 'yards']),
      linear('ft', 'ft', 'Foot', 0.3048, ['foot', 'feet']),
      linear('in', 'in', 'Inch', 0.0254, ['inch', 'inches']),
      linear('nmi', 'nmi', 'Nautical Mile', 1852, ['nautical mile', 'nautical miles']),
      linear('au', 'AU', 'Astronomical Unit', 1.495978707e11, ['astronomical unit']),
      linear('ly', 'ly', 'Light Year', 9.4607304725808e15, ['light year', 'light years']),
    ],
  },
  {
    id: 'mass',
    label: 'Mass',
    baseUnitId: 'kg',
    units: [
      linear('kg', 'kg', 'Kilogram', 1, ['kilogram', 'kilograms', 'kilo', 'kilos']),
      linear('g', 'g', 'Gram', 0.001, ['gram', 'grams']),
      linear('mg', 'mg', 'Milligram', 1e-6, ['milligram', 'milligrams']),
      linear('ug', 'μg', 'Microgram', 1e-9, ['microgram', 'micrograms']),
      linear('t', 't', 'Metric Ton', 1000, ['tonne', 'metric ton', 'metric tons']),
      linear('lb', 'lb', 'Pound', 0.45359237, ['pound', 'pounds', 'lbs']),
      linear('oz', 'oz', 'Ounce', 0.028349523125, ['ounce', 'ounces']),
      linear('amu', 'u', 'Atomic Mass Unit', 1.6605390666e-27, ['dalton', 'amu']),
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    baseUnitId: 'C',
    units: [
      {
        id: 'C',
        symbol: '°C',
        name: 'Celsius',
        aliases: ['c', '°c', 'celsius', 'centigrade'],
        toBase: (v) => v,
        fromBase: (b) => b,
      },
      {
        id: 'F',
        symbol: '°F',
        name: 'Fahrenheit',
        aliases: ['f', '°f', 'fahrenheit'],
        toBase: (v) => ((v - 32) * 5) / 9,
        fromBase: (b) => (b * 9) / 5 + 32,
      },
      {
        id: 'K',
        symbol: 'K',
        name: 'Kelvin',
        aliases: ['k', 'kelvin'],
        toBase: (v) => v - 273.15,
        fromBase: (b) => b + 273.15,
      },
      {
        id: 'R',
        symbol: '°R',
        name: 'Rankine',
        aliases: ['r', '°r', 'rankine'],
        toBase: (v) => ((v - 491.67) * 5) / 9,
        fromBase: (b) => ((b + 273.15) * 9) / 5,
      },
    ],
  },
  {
    id: 'velocity',
    label: 'Velocity',
    baseUnitId: 'mps',
    units: [
      linear('mps', 'm/s', 'Meters per second', 1, ['meters per second', 'm/s']),
      linear('kmh', 'km/h', 'Kilometers per hour', 1 / 3.6, ['kph', 'km/h', 'kilometers per hour']),
      linear('mph', 'mph', 'Miles per hour', 0.44704, ['mph', 'miles per hour']),
      linear('kn', 'kn', 'Knot', 1852 / 3600, ['knot', 'knots']),
      linear('fps', 'ft/s', 'Feet per second', 0.3048, ['feet per second', 'ft/s']),
      linear('mach', 'Ma', 'Mach (ISA Sea Level)', 340.29, ['mach']),
      linear('c', 'c', 'Speed of Light', 299792458, ['speed of light']),
    ],
  },
  {
    id: 'time',
    label: 'Time',
    baseUnitId: 's',
    units: [
      linear('s', 's', 'Second', 1, ['second', 'seconds', 'sec']),
      linear('ms', 'ms', 'Millisecond', 0.001, ['millisecond', 'milliseconds']),
      linear('us', 'μs', 'Microsecond', 1e-6, ['microsecond', 'microseconds']),
      linear('ns', 'ns', 'Nanosecond', 1e-9, ['nanosecond', 'nanoseconds']),
      linear('min', 'min', 'Minute', 60, ['minute', 'minutes']),
      linear('h', 'h', 'Hour', 3600, ['hour', 'hours', 'hr']),
      linear('d', 'd', 'Day', 86400, ['day', 'days']),
      linear('wk', 'wk', 'Week', 604800, ['week', 'weeks']),
      linear('yr', 'yr', 'Julian Year', 31557600, ['year', 'years']),
    ],
  },
  {
    id: 'area',
    label: 'Area',
    baseUnitId: 'm2',
    units: [
      linear('m2', 'm²', 'Square Meter', 1, ['square meter', 'square meters', 'sqm']),
      linear('km2', 'km²', 'Square Kilometer', 1e6, ['square kilometer', 'sqkm']),
      linear('cm2', 'cm²', 'Square Centimeter', 1e-4, ['square centimeter']),
      linear('ha', 'ha', 'Hectare', 10000, ['hectare', 'hectares']),
      linear('acre', 'ac', 'Acre', 4046.8564224, ['acre', 'acres']),
      linear('ft2', 'ft²', 'Square Foot', 0.09290304, ['square foot', 'square feet', 'sqft']),
      linear('mi2', 'mi²', 'Square Mile', 2589988.110336, ['square mile', 'square miles']),
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    baseUnitId: 'L',
    units: [
      linear('L', 'L', 'Liter', 1, ['liter', 'liters', 'litre', 'litres']),
      linear('mL', 'mL', 'Milliliter', 0.001, ['milliliter', 'milliliters', 'cc']),
      linear('m3', 'm³', 'Cubic Meter', 1000, ['cubic meter', 'cubic meters']),
      linear('gal', 'gal', 'US Gallon', 3.785411784, ['gallon', 'gallons', 'us gallon']),
      linear('qt', 'qt', 'US Quart', 0.946352946, ['quart', 'quarts']),
      linear('pt', 'pt', 'US Pint', 0.473176473, ['pint', 'pints']),
      linear('floz', 'fl oz', 'US Fluid Ounce', 0.0295735295625, ['fluid ounce', 'fluid ounces']),
    ],
  },
  {
    id: 'energy',
    label: 'Energy',
    baseUnitId: 'J',
    units: [
      linear('J', 'J', 'Joule', 1, ['joule', 'joules']),
      linear('kJ', 'kJ', 'Kilojoule', 1000, ['kilojoule', 'kilojoules']),
      linear('MJ', 'MJ', 'Megajoule', 1e6, ['megajoule', 'megajoules']),
      linear('cal', 'cal', 'Calorie', 4.184, ['calorie', 'calories']),
      linear('kcal', 'kcal', 'Kilocalorie', 4184, ['kilocalorie', 'kilocalories']),
      linear('Wh', 'Wh', 'Watt-hour', 3600, ['watt hour', 'watt-hour']),
      linear('kWh', 'kWh', 'Kilowatt-hour', 3.6e6, ['kilowatt hour', 'kilowatt-hour']),
      linear('eV', 'eV', 'Electronvolt', 1.602176634e-19, ['electronvolt', 'electronvolts']),
      linear('BTU', 'BTU', 'British Thermal Unit', 1055.05585262, ['btu']),
    ],
  },
  {
    id: 'power',
    label: 'Power',
    baseUnitId: 'W',
    units: [
      linear('W', 'W', 'Watt', 1, ['watt', 'watts']),
      linear('kW', 'kW', 'Kilowatt', 1000, ['kilowatt', 'kilowatts']),
      linear('MW', 'MW', 'Megawatt', 1e6, ['megawatt', 'megawatts']),
      linear('hp', 'hp', 'Mechanical Horsepower', 745.699871582, ['horsepower']),
      linear('btuh', 'BTU/h', 'BTU per hour', 0.29307107, ['btu per hour']),
    ],
  },
  {
    id: 'pressure',
    label: 'Pressure',
    baseUnitId: 'Pa',
    units: [
      linear('Pa', 'Pa', 'Pascal', 1, ['pascal', 'pascals']),
      linear('kPa', 'kPa', 'Kilopascal', 1000, ['kilopascal', 'kilopascals']),
      linear('MPa', 'MPa', 'Megapascal', 1e6, ['megapascal', 'megapascals']),
      linear('bar', 'bar', 'Bar', 1e5, ['bar', 'bars']),
      linear('atm', 'atm', 'Standard Atmosphere', 101325, ['atmosphere', 'atmospheres']),
      linear('psi', 'psi', 'Pounds per sq. inch', 6894.75729317, ['psi']),
      linear('mmHg', 'mmHg', 'Millimeters of Mercury', 133.322387415, ['torr', 'mmhg']),
    ],
  },
  {
    id: 'data',
    label: 'Data',
    baseUnitId: 'B',
    units: [
      linear('bit', 'bit', 'Bit', 0.125, ['bit', 'bits']),
      linear('B', 'B', 'Byte', 1, ['byte', 'bytes']),
      linear('KB', 'KB', 'Kilobyte (SI)', 1e3, ['kilobyte', 'kilobytes']),
      linear('MB', 'MB', 'Megabyte (SI)', 1e6, ['megabyte', 'megabytes']),
      linear('GB', 'GB', 'Gigabyte (SI)', 1e9, ['gigabyte', 'gigabytes']),
      linear('TB', 'TB', 'Terabyte (SI)', 1e12, ['terabyte', 'terabytes']),
      linear('KiB', 'KiB', 'Kibibyte', 1024, ['kibibyte']),
      linear('MiB', 'MiB', 'Mebibyte', 1048576, ['mebibyte']),
      linear('GiB', 'GiB', 'Gibibyte', 1073741824, ['gibibyte']),
    ],
  },
  {
    id: 'angle',
    label: 'Angle',
    baseUnitId: 'deg',
    units: [
      linear('deg', '°', 'Degree', 1, ['degree', 'degrees', 'deg']),
      linear('rad', 'rad', 'Radian', 180 / Math.PI, ['radian', 'radians']),
      linear('grad', 'grad', 'Gradian', 0.9, ['gradian', 'gradians', 'gon']),
      linear('arcmin', '′', 'Arcminute', 1 / 60, ['arcminute', 'arcminutes']),
      linear('arcsec', '″', 'Arcsecond', 1 / 3600, ['arcsecond', 'arcseconds']),
      linear('rev', 'rev', 'Revolution', 360, ['revolution', 'revolutions', 'turn']),
    ],
  },
  {
    id: 'frequency',
    label: 'Frequency',
    baseUnitId: 'Hz',
    units: [
      linear('Hz', 'Hz', 'Hertz', 1, ['hertz']),
      linear('kHz', 'kHz', 'Kilohertz', 1e3, ['kilohertz']),
      linear('MHz', 'MHz', 'Megahertz', 1e6, ['megahertz']),
      linear('GHz', 'GHz', 'Gigahertz', 1e9, ['gigahertz']),
      linear('rpm', 'rpm', 'Revolutions / min', 1 / 60, ['rpm']),
    ],
  },
];

export function convertUnitValue(
  categoryId: string,
  fromUnitId: string,
  toUnitId: string,
  value: number
): number {
  const cat = UNIT_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return value;
  const from = cat.units.find((u) => u.id === fromUnitId);
  const to = cat.units.find((u) => u.id === toUnitId);
  if (!from || !to) return value;
  const baseVal = from.toBase(value);
  return to.fromBase(baseVal);
}

export function formatConvertedNumber(num: number): string {
  if (!Number.isFinite(num)) return '—';
  if (num === 0) return '0';
  const abs = Math.abs(num);
  if (abs >= 1e10 || abs < 1e-6) {
    return num.toExponential(6).replace(/\.?0+e/, 'e');
  }
  return Number(num.toPrecision(10)).toString();
}

export function findUnitMatch(
  query: string,
  preferredCategory?: string
): { categoryId: string; unitId: string } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const categories = preferredCategory
    ? [
        ...UNIT_CATEGORIES.filter((c) => c.id.toLowerCase() === preferredCategory.toLowerCase()),
        ...UNIT_CATEGORIES.filter((c) => c.id.toLowerCase() !== preferredCategory.toLowerCase()),
      ]
    : UNIT_CATEGORIES;

  // Exact match on id, symbol, or alias
  for (const cat of categories) {
    for (const u of cat.units) {
      if (u.aliases.includes(q)) {
        return { categoryId: cat.id, unitId: u.id };
      }
    }
  }

  // Partial match
  for (const cat of categories) {
    for (const u of cat.units) {
      if (u.aliases.some((a) => a.includes(q) || q.includes(a))) {
        return { categoryId: cat.id, unitId: u.id };
      }
    }
  }
  return null;
}
