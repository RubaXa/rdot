import Task from './task';
import {STORE_NAME} from './const';

export function getHash() {
	return location.toString().split('#/')[1] || 'all';
}

export function loadTodos() {
	const todos:{title:string, completed:boolean}[] = (JSON.parse(localStorage.getItem(STORE_NAME)) || []);
	return todos.map(data => new Task(data.title, data.completed));
}

export function saveTodos(todos) {
	localStorage.setItem(STORE_NAME, JSON.stringify(todos));
}

export function filterByHash(dot) {
	return dot.arrayFilter(([filter, todos]) => {
		return {
			array: todos,
			callback: (todo:Task) => (
				('all' === filter) ||
				('active' === filter && !todo.completed) ||
				('completed' === filter && todo.completed)
			)
		};
	});
}

export function filterByCompleted(dot) {
	return dot.arrayFilter(([todos]) => ({
		array: todos,
		callback: (todo:Task) => !todo.completed
	}))
}

export function isAllCompleted(dot) {
	return dot.map(([filteredTodos]) => filteredTodos.length && filteredTodos.every(todo => todo.completed));
}
