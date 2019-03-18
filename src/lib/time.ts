export function timeConversion (millisec) {

    const seconds = parseInt((millisec / 1000).toFixed(1), 10);

    const minutes = parseInt((millisec / (1000 * 60)).toFixed(1), 10);

    const hours = parseInt((millisec / (1000 * 60 * 60)).toFixed(1), 10);

    const days = parseInt((millisec / (1000 * 60 * 60 * 24)).toFixed(1), 10);

    if (seconds < 60) {
        return seconds + ' Sec';
    } else if (minutes < 60) {
        return minutes + ' Min';
    } else if (hours < 24) {
        return hours + ' Hrs';
    } else {
        return days + ' Days';
    }
}
