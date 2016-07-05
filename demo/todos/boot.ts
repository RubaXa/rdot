import {render} from './../../src/rdom';
import TodosApp from './blocks/app';

export default function boot(container:HTMLElement) {
	return render(container, TodosApp, []);
}
