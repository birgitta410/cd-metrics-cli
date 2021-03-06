import moment = require("moment");

// Yep, there's a TimeUtil class :-)
export class TimeUtil {
  public static normalizeTime(time: string): string {
    return moment(time).format("YYYY-MM-DD HH:mm:ss");
  }

  public static normalizedString(dateTime: moment.Moment): string {
    return dateTime.format("YYYY-MM-DD HH:mm:ss");
  }

  public static normalizedNow(): string {
    return moment().format("YYYY-MM-DD HH:mm:ss");
  }

  public static gitlabApiDateString(date: moment.Moment): string {
    return date.format("YYYY-MM-DDT00:00:00.000+00:00");
  }

  public static durationToSpreadsheetString(duration: moment.Duration|undefined): string {
    if(duration !== undefined) { 
      return `${Math.round(duration.asHours())}:${duration.minutes()}`;
    } else {
      return "";
    }
  }
}
