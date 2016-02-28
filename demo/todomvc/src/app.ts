import {reactive} from '../../../src/rdot';
import Task from './task';
import {STORE_NAME, ENTER_KEY} from './const';
import {getHash, loadTodos, saveTodos, filterByHash, filterByCompleted, isAllCompleted} from './utils';

export default class TodoApp {
	@reactive
	public newTodo:string = '';

	@reactive
	public filter:string = getHash();

	@reactive
	public todos:Task[] = loadTodos();

	@reactive(['filter', 'todos'], filterByHash)
	private filteredTodos:Task[];

	@reactive(['todos'], filterByCompleted)
	private activeTodos:Task[];

	@reactive(['todos', 'activeTodos'], isAllCompleted)
	private allChecked:boolean = false;

	handleAddTodo(evt) {
		if (evt.keyCode === ENTER_KEY) {
			const title = evt.target.value.trim();

			if (title) {
				this.todos = [new Task(title, false)].concat(this.todos);
				evt.target.value = '';
			}
		}
	}

	handleRemove(todo) {
		const todos = this.todos.slice(0);
		todos.splice(todos.indexOf(todo), 1);
		this.todos = todos;
	}

	handleMarkAll() {
		const state = !this.allChecked;
		this.todos.forEach(todo => todo.completed = state);
	}

	handleClearCompleted() {
		this.todos = this.todos.filter(todo => !todo.completed);
	}

	@reactive(['todos'])
	handleSave() {
		saveTodos(this.todos);
	}

	render() {
		return () => `
			<section class="todoapp">
				<header class="header">
					<h1>todos</h1>
					<input value="${this.newTodo}" on-keydown="${(evt) => this.handleAddTodo(evt)}" class="new-todo" placeholder="What needs to be done?" autofocus/>
				</header>

				<section class="main">
					<input id="toggle-all" on-click="${() => this.handleMarkAll()}" class="toggle-all" type="checkbox" checked="{this.allChecked}"/>
					<label for="toggle-all">Mark all as complete</label>
					<ul class="todo-list">
						${this.filteredTodos.map((todo:Task) => `
							<li key="${todo.id}" class="${todo.completed ? 'completed' : ''}">
								<div class="view">
									<input checked="${todo.completed}" on-change="${() => todo.completed = !todo.completed}" class="toggle" type="checkbox" />
									<label>${todo.title}</label>
									<button on-click="${() => this.handleRemove(todo)}" class="destroy"/>
								</div>
							</li>
						`)}
					</ul>
				</section>

				${this.todos.length ? `
					<footer class="footer">
						<span class="todo-count">${this.activeTodos.length} items left</span>
						<ul class="filters">
							<li><a href="#/" class="${this.filter === 'all' ? 'selected' : ''}">All</a></li>
							<li><a href="#/active" class="${this.filter === 'active' ? 'selected' : ''}">Active</a></li>
							<li><a href="#/completed" class="${this.filter === 'completed' ? 'selected' : ''}">Completed</a></li>
						</ul>
						<fn:if test="this.todos.length != this.activeTodos.length">
							<span><button class="clear-completed" on-click="${() => this.handleClearCompleted()}">Clear completed</button></span>
						</fn:if>
					</footer>
				` : null}
			</section>
		`;
	}
}
