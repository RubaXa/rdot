import Todo from '../models/todo';
import {RStream} from '../../../src/rdot';
import {reactive} from '../../../src/rdecorators';

export default class TodoList {
	static template:string = `<ul id="todo-list">
		<for data="this.items" as="todo">
			<li class="{todo.completed ? 'completed' : ''}">
				<div class="view">
					<input class="toggle" type="checkbox" checked="{todo.completed}"/>
					<label>{todo.text}</label>
					<button on-click="{this.handleRemove(todo)}" class="destroy"/>
				</div>
			</li>
		</for>
	</ul>`;

	@reactive public items:Todo[];
	@reactive public onremove:RStream<Todo>;

	handleRemove(todo) {
		this.onremove.add(todo);
	}
}
