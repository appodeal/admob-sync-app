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
        return this.exec(this.tasks)
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

    private exec (tasks: Array<Task>, noProgress = false) {
        return tasks.reduce((promise, task, index) => {
            return promise.then(() => {
                if (this.state === TaskRunnerState.cancelled) {
                    throw new Error('Canceled');
                }
                let currentStep = Promise.resolve();
                if (this.hasSkip()) {
                    if (this.currentSkip === task.name) {
                        this.currentSkip = null;
                    } else {
                        if (!noProgress) {
                            this.increaseCompleted();
                        }
                        return currentStep;
                    }
                }
                if (this.hasReturn()) {
                    let returnIndex = this.tasks.findIndex(task => task.name === this.currentReturn);
                    this.currentReturn = null;
                    if (returnIndex !== -1) {
                        let tasksToRepeat = this.tasks.slice(returnIndex, index);
                        currentStep = currentStep.then(() => this.exec(tasksToRepeat, true));
                    }
                }
                return currentStep
                    .then(() => {
                        let taskArgs = this.taskArgs || [];
                        this.taskArgs = null;
                        console.log(`Execute task: ${task['func'].toString()}`);
                        return task.execute(...taskArgs)
                            .catch(err => {
                                console.error(err);
                                console.error(task['func'].toString());
                                throw err;
                            });
                    })
                    .then(() => {
                        if (!noProgress) {
                            this.increaseCompleted();
                        }
                    });
            });
        }, Promise.resolve());
    }

    private hasSkip () {
        return !!this.currentSkip;
    }

    private hasReturn () {
        return !!this.currentReturn;
    }

    private increaseCompleted () {
        this.completed++;
        this.emit('progress', {
            total: this.total,
            completed: this.completed,
            percent: (this.completed / this.total) * 100
        });
    }

    skipTo (name: string, ...args: Array<any>) {
        this.currentSkip = name;
        this.currentReturn = null;
        this.taskArgs = args;
    }

    returnTo (name: string, ...args: Array<any>) {
        this.currentReturn = name;
        this.currentSkip = null;
        this.taskArgs = args;
    }
}
