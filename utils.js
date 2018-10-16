var startOfWeek = require('date-fns/start_of_week');
var format = require('date-fns/format');
var date = require('date-fns');

module.exports = {
    getWeekStart: function () {
        var now = new Date();
        if (date.getISODay(now) >= 5 || date.isFriday(now) && date.getHours(now) > 17) {
            // It's weekend, return the next weeks timetable
            return format(startOfWeek(date.addWeeks(now, 1), { weekStartsOn: 1 }), 'YYYY-MM-DD');
        } else {
            // It's Monday-Friday, return this weeks timetable
            return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'YYYY-MM-DD');
        }
    }
}