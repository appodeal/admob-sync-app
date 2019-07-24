import {EventEmitter} from 'events';


class Task {

    constructor (
        private func: (...args: Array<any>) => Promise<any>,
        public name?: string
    ) {}

    async execute (...args: Array<any>) {
        return this.func(...args);
    }
}

export enum TaskRunnerState {
    idle,
    running,
    cancelled,
    finished
}

export class TaskRunner extends EventEmitter {
    private tasks: Array<Task> = [];
    private currentSkip: string = null;
    private currentReturn: string = null;
    private taskArgs: Array<any> = null;
    state = TaskRunnerState.idle;
    private activeTaskNum = 0;

    get total () {
        return this.tasks.length;
    }

    completed = 0;

    createTask (func: (...args: Array<any>) => Promise<any> | any, taskName?: string) {
        let task = new Task(func, taskName);
        this.tasks.push(task);
    }

    runTasks () {
        this.state = TaskRunnerState.running;
        return this.exec()
            .then(() => {
                this.state = TaskRunnerState.finished;
            })
            .catch(err => {
                if (err.message === 'Canceled') {
                    this.emit('cancel');
                } else {
                    throw err;
                }
            });
    }

    break () {
        return new Promise(resolve => {
            if (this.state === TaskRunnerState.running) {
                this.once('cancel', () => resolve());
            } else {
                resolve();
            }
            this.state = TaskRunnerState.cancelled;
        });
    }

    private exec () {
        return new Promise(async (resolve, reject) => {

            const runNext = () => {
                if (this.state === TaskRunnerState.cancelled) {
                    return reject(new Error('Canceled'));
                }
                const activeTask = this.tasks[this.activeTaskNum];
                let taskArgs = this.taskArgs || [];
                this.taskArgs = null;
                console.log(`Execute task: ${activeTask['func'].toString()}`);
                return activeTask.execute(...taskArgs)
                    .then(() => {
                        if (!this.hasSkip() && !this.hasReturn()) {
                            this.activeTaskNum++;
                        }
                        this.increaseCompleted();
                        this.currentSkip = '';
                        this.currentReturn = '';
                        if (this.activeTaskNum === this.tasks.length) {
                            return resolve();
                        }
                        setTimeout(() => runNext());
                    })
                    .catch(err => {
                        console.error(err);
                        console.error(activeTask['func'].toString());
                        return reject(err);
                    });
            };
            setTimeout(() => runNext());
        });
    }

    private hasSkip () {
        return !!this.currentSkip;
    }

    private hasReturn () {
        return !!this.currentReturn;
    }

    private increaseCompleted () {
        this.completed++;
        let completed = Math.max(this.completed, this.activeTaskNum);
        this.emit('progress', {
            total: this.total,
            completed: completed,
            percent: (completed / this.total) * 100
        });
    }

    skipTo (name: string, ...args: Array<any>) {
        this.goTo(name, ...args);

        this.currentSkip = name;
        this.currentReturn = null;
    }

    returnTo (name: string, ...args: Array<any>) {
        this.goTo(name, ...args);

        this.currentReturn = name;
        this.currentSkip = null;
    }

    private goTo (name: string, ...args: Array<any>) {
        const next = this.tasks.findIndex(task => task.name === name);
        this.completed += next - this.activeTaskNum - 1;
        this.activeTaskNum = next;
        this.taskArgs = args;
    }
}
