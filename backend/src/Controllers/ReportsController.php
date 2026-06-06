<?php
namespace App\Controllers;
use App\Core\Response;
class ReportsController {
    public function index(): void {
        Response::json([
            ['name'=>'Edition Performance','desc'=>'Pages, delays, quality by edition','formats'=>['PDF','Excel']],
            ['name'=>'Employee Performance','desc'=>'Productivity & appreciation timeline','formats'=>['PDF','Excel']],
            ['name'=>'Printing Efficiency','desc'=>'SLA breach & bottleneck analysis','formats'=>['PDF','Excel']],
            ['name'=>'Content Quality','desc'=>'Grades, sentiment, legal-risk words','formats'=>['PDF','Excel']],
            ['name'=>'Advertisement Analytics','desc'=>'Ad vs news ratio, revenue ratio','formats'=>['PDF','Excel']],
        ]);
    }
}
