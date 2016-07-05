import ReactiveDot, {RStream, rexpression} from '../../../src/rdot';
import {reactive} from '../../../src/rdecorators';

import Todo from '../models/todo';

import Header from './header';
import TodoList from './todo-list';
import FooterApp from './footer-app';
import FooterInfo from './footer-info';

const ALL_FILTER:string = '';

export default class TodosApp {
	static blocks:any = {
		'header': Header,
		'todo-list': TodoList,
		'footer-app': FooterApp,
		'footer-info': FooterInfo,
	};

	static template:string = `<div>
		<section id="todoapp">
			<header
				onadd="{this.addStream}"
			/>

			<section id="main">
				<input id="toggle-all" type="checkbox"/>
				<label for="toggle-all">Mark all as complete</label>

				<todo-list
					items="{this.filteredTodos}"
					onremove="{this.removeStream}"
				/>
			</section>

			<if test="this.todos.length">
				<footer-app
					filter="{this.filter}"
					remaining="{this.remainingCount}"
					completed="{this.completedCount}"
					onclearall="{this.clearAllStream}"
				/>
			</if>
		</section>
		
		<footer-info/>
	</div>`;

	@reactive public filter:string = ALL_FILTER;
	@reactive public remainingCount:number;
	@reactive public completedCount:number;

	@reactive public addStream:RStream<string> = new RStream<string>();
	@reactive public removeStream:RStream<Todo> = new RStream<Todo>();
	@reactive public clearAllStream:RStream<boolean> = new RStream<boolean>();

	@reactive public todos:Todo[] = [];
	@reactive public filteredTodos:Todo[];
	
	constructor() {
		ReactiveDot.fromEvent(window, 'hashchange').onValue(() => this.routing());
		this.routing();

		this.filteredTodos = this.todos.filter((todo:Todo) => {
			const filter = this.filter;

			return (
				(ALL_FILTER === filter) ||
				('active' === filter && !todo.completed) ||
				('completed' === filter && todo.completed)
			);
		});

		this.todos.unshift(new Todo('foo', true));

		this.completedCount = rexpression<number>(() => this.todos.reduce((count:number, todo:Todo) => count + +todo.completed, 0));
		this.remainingCount = rexpression<number>(() => this.todos.length - this.completedCount);

		this.addStream.onValue((text:string) => {
			this.todos.unshift(new Todo(text));
		});

		this.removeStream.onValue((todo:Todo) => {
			this.todos.splice(this.todos.indexOf(todo), 1);
		});

		this.clearAllStream.onValue(() => {
			this.todos = this.todos.filter((todo:Todo) => !todo.completed);
		});
	}

	routing() {
		this.filter = location.href.split('#/')[1] || ALL_FILTER;
	}
}
