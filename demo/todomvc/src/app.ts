import {RDot, reactive} from '../../../src/rdot';
import Task from './task';
import {STORE_NAME, ENTER_KEY} from './const';
import {getHash, loadTodos, saveTodos, filterByHash, filterByCompleted, isAllCompleted} from './utils';

export default class TodoApp {
	// Фильтр задач
	@reactive
	public filter:string = getHash();

	// Список всех задач
	@reactive
	public todos:Task[] = loadTodos();

	// Текущий список задач в зависипости от фильтра
	@reactive(['filter', 'todos'], filterByHash)
	private filteredTodos:Task[];

	// Список всех активных задач
	@reactive(['todos'], filterByCompleted)
	private activeTodos:Task[];

	// Состояние всех текущих задач
	@reactive(['filteredTodos'], isAllCompleted)
	private allCompleted:boolean;

	constructor() {
		// Изменяем фильтр в зависимости от hash
		RDot.fromEvent(window, 'hashchange').onValue(() => {
			this.filter = getHash();
		});

		// Вызываем сохранение в зависимости вот задач
		new RDot<any>(() => [this.todos, this.activeTodos]).onValue(() => this.handleSave());
	}

	// Добавление задачи
	handleAddTodo(evt) {
		if (evt.keyCode === ENTER_KEY) {
			const title = evt.target.value.trim();

			if (title) {
				this.todos = [new Task(title, false)].concat(this.todos);
				evt.target.value = '';
			}
		}
	}

	// Удаление задачи
	handleRemove(todo) {
		const todos = this.todos.slice(0);
		todos.splice(todos.indexOf(todo), 1);
		this.todos = todos;
	}

	// Отметить все задача как готовые
	handleMarkAll() {
		const state = !this.allCompleted;
		this.todos.forEach((todo:Task) => todo.completed = state);
	}

	// Отчитстить все готовые задачи
	handleClearCompleted() {
		this.todos = this.todos.filter(todo => !todo.completed);
	}

	handleSave() {
		saveTodos(this.todos);
	}

	render() {
		return `
			<section class="todoapp">
				<header class="header">
					<h1>todos</h1>
					<input on-keydown="${(evt) => this.handleAddTodo(evt)}" class="new-todo" placeholder="What needs to be done?" autofocus/>
				</header>

				<section class="main">
					<input id="toggle-all" on-click="${() => this.handleMarkAll()}" checked="${this.allCompleted}" class="toggle-all" type="checkbox"/>
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

				${!!this.todos.length ? `
					<footer class="footer">
						<span class="todo-count">${this.activeTodos.length} items left</span>
						<ul class="filters">
							<li><a href="#/" class="${this.filter === 'all' ? 'selected' : ''}">All</a></li>
							<li><a href="#/active" class="${this.filter === 'active' ? 'selected' : ''}">Active</a></li>
							<li><a href="#/completed" class="${this.filter === 'completed' ? 'selected' : ''}">Completed</a></li>
						</ul>
						${this.todos.length != this.activeTodos.length ? `
							<button class="clear-completed" on-click="${() => this.handleClearCompleted()}">Clear completed</button>
						` : null}
					</footer>
				` : null}
			</section>
		`;
	}
}
