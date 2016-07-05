import {RStream} from '../../../src/rdot';
import {reactive} from '../../../src/rdecorators';

import Link from './link';

export default class FooterApp {
	@reactive public filter:string;
	@reactive public remaining:number;
	@reactive public completed:number;
	@reactive public onclearall:RStream<boolean>;

	static blocks = {
		'link': Link
	};

	static template:string = `<footer id="footer">
		<span id="todo-count">
			<strong>{this.remaining}</strong>
			{this.remaining == 1 ? ' item left' : ' items left'}
		</span>
		
		<ul id="filters">
			<li><link selected="{this.filter == ''}" to="#/" text="All"/></li>
			<li><link selected="{this.filter == 'active'}" to="#/active" text="Active"/></li>
			<li><link selected="{this.filter == 'completed'}" to="#/completed" text="Completed"/></li>
		</ul>
		
		<if test="this.completed">
			<button id="clear-completed" on-click="{this.handleClearAll()}">Clear completed</button>
		</if>
	</footer>`;

	handleClearAll() {
		this.onclearall.add(true);
	}
}
