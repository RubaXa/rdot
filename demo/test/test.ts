import ReactiveDot from '../../src/rdot';
import {reactive} from '../../src/rdecorators';
import {default as ReactiveList, ReactiveModel} from '../../src/rdot.list';
import {render} from './../../src/rdom';

class HelloMessage {
	static template:string = `<div>Hello {this.name}!</div>`;

	@reactive
	public name:string;

	constructor(name:string) {
		this.name = name;
	}
}

class Timer {
	static template:string = `<div>Seconds Elapsed: {this.secondsElapsed}</div>`;

	@reactive
	private secondsElapsed:number = 0;

	didMount() {
		setInterval(() => {
			this.secondsElapsed++;
		}, 1000);
	}
}

interface ITodo {
	title:string;
	completed?:boolean;
}

class Todo extends ReactiveModel<ITodo> implements ITodo {
	@reactive public title:string;
	@reactive public completed:boolean;

	constructor(title:string) {
		super({title, completed: false}, ['title', 'completed']);
	}
}

class TodoApp {
	static template:string = `<div>
		<h3>TODO</h3>
		<form on-submit="{this.handleSubmit()}">
			<input value="{this.newTodo}"/>
			<button>Add #{this.todos.length + 1}</button>
		</form>
		<ul>
			<for data="this.filteredTodo" as="todo">
				<li class="{todo.completed}">
					<input checked="{todo.completed}" type="checkbox"/>
					{todo.title}
					<a href="#" on-click="{this.removeTodo(todo)}">[x]</a>
				</li>
			</for>
		</ul>
	</div>`;

	@reactive
	private filter:string = 'all';

	@reactive
	private newTodo:string = '';

	private todos:ReactiveList;
	private filteredTodo:ReactiveList;

	constructor() {
		this.todos = new ReactiveList();
		this.filteredTodo = this.todos.filter((todo:Todo) => {
			const filter = this.filter;

			return (
				('all' === filter) ||
				('active' === filter && !todo.completed) ||
				('completed' === filter && todo.completed)
			);
		});

		setTimeout(() => {
			this.addTodo('foo');
			this.addTodo('bar');
		}, 500);
	}

	addTodo(value:string) {
		this.todos.push(new Todo(value));
	}

	removeTodo(todo) {
		this.todos.remove(todo);
	}

	handleSubmit() {
		const value = this.newTodo.trim();

		value && this.addTodo(value);
		this.newTodo = '';
	}
}

export default function boot(container:HTMLElement) {
	return {
		HelloMessage: render(container, HelloMessage, ['John']),
	 	Timer: render(container, Timer, []),
	 	TodoApp: render(container, TodoApp, []),
	};
}
