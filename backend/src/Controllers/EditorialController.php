<?php
namespace App\Controllers;
use App\Core\Response;
class EditorialController {
    public function index(): void {
        // TODO: read from `editorial_plan` + AI trend service.
        Response::json([
            'columns' => ['Breaking','Exclusive','Follow-up','Investigative'],
            'stories' => [
                ['id'=>1,'title'=>'Assembly session live coverage','reporter'=>'R. Sharma','priority'=>'Breaking','status'=>'Assigned'],
                ['id'=>2,'title'=>'Water crisis ground report','reporter'=>'M. Verma','priority'=>'Investigative','status'=>'In Progress'],
                ['id'=>3,'title'=>'Exclusive: Metro phase-2 plan','reporter'=>'P. Jain','priority'=>'Exclusive','status'=>'Approved'],
                ['id'=>4,'title'=>'Follow-up: school fee hike','reporter'=>'S. Nair','priority'=>'Follow-up','status'=>'Draft'],
            ],
            'trending' => ['#RajasthanBudget','Monsoon forecast','IPL auction','Ambedkar Jayanti','Metro Phase 2'],
        ]);
    }
}
