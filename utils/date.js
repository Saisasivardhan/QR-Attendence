function formatIstDateParts(value) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return { year, month, day };
}

function getIstDateString(value = new Date()) {
  const { year, month, day } = formatIstDateParts(value);
  return `${year}-${month}-${day}`;
}

function getCurrentIstDateString() {
  return getIstDateString(new Date());
}

function getIstDayRange(dateString) {
  const start = new Date(`${dateString}T00:00:00+05:30`);
  const end = new Date(`${dateString}T23:59:59.999+05:30`);

  return { start, end };
}

module.exports = {
  getIstDateString,
  getCurrentIstDateString,
  getIstDayRange,
};